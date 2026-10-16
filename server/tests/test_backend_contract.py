"""Regression checks for the existing API, using no real camera or database.

Run from server/: python -X utf8 -B -m unittest discover -s tests -v
"""

import importlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


class BackendContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        database = ModuleType("config.bn_supabase")
        database.supabase_client = MagicMock()
        database.supabase_admin = MagicMock()
        torch = ModuleType("torch")
        torch.cuda = SimpleNamespace(is_available=lambda: False)
        ultralytics = ModuleType("ultralytics")
        ultralytics.YOLO = MagicMock(side_effect=AssertionError("Do not load real models in these tests"))
        cv2 = ModuleType("cv2")
        cv2.CAP_DSHOW = 700
        cv2.VideoCapture = MagicMock()

        cls.modules = patch.dict(sys.modules, {
            "config.bn_supabase": database,
            "torch": torch,
            "ultralytics": ultralytics,
            "cv2": cv2,
        })
        cls.modules.start()
        cls.addClassCleanup(cls.modules.stop)
        cls.app = importlib.import_module("main").app
        cls.camera = importlib.import_module("services.camera_service")
        cls.summary = importlib.import_module("services.summary_service")
        cls.auth = importlib.import_module("services.auth_service")
        cls.teachers = importlib.import_module("services.teacher_service")
        cls.stream = importlib.import_module("routes.camera.websocket")
        cls.core = importlib.import_module("core.camera_thread")
        cls.verify_token = staticmethod(importlib.import_module("utils.auth").verify_token)
        cls.database = database
        cls.cv2 = cv2

    def setUp(self):
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)
        self.camera.camera_threads.clear()
        self.camera.available_cameras.clear()
        self.app.dependency_overrides.clear()
        self.addCleanup(self.app.dependency_overrides.clear)
        self.database.supabase_client.reset_mock(return_value=True, side_effect=True)
        self.database.supabase_admin.reset_mock(return_value=True, side_effect=True)

    def test_existing_urls_methods_and_request_shapes(self):
        paths = self.app.openapi()["paths"]
        expected = {
            "/api/camera/list-camera": "get",
            "/api/camera/start-all": "get",
            "/api/camera/stop-all": "get",
            "/api/camera/close-all": "get",
            "/api/camera/summary-to-supabase": "get",
            "/api/auth/login-by-id": "post",
            "/api/admin/create-teacher": "post",
        }
        self.assertEqual(set(paths), set(expected))
        for path, method in expected.items():
            self.assertIn(method, paths[path])
        login_body = paths["/api/auth/login-by-id"]["post"]["requestBody"]["content"]
        self.assertIn("application/x-www-form-urlencoded", login_body)
        self.assertEqual(self.client.post("/api/auth/login-by-id", data={}).status_code, 422)
        self.assertEqual(self.client.post("/api/admin/create-teacher", json={}).status_code, 422)
        self.assertEqual(self.client.get("/api/camera/start-all").status_code, 422)

    def test_camera_scan_returns_existing_payload_and_releases_handles(self):
        handles = []
        for camera_id in range(10):
            handle = MagicMock()
            handle.isOpened.return_value = camera_id in (0, 2)
            handles.append(handle)
        with patch.object(self.cv2, "VideoCapture", side_effect=handles):
            response = self.client.get("/api/camera/list-camera")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([cam["id"] for cam in response.json()["cameras"]], [0, 2])
        self.assertEqual(self.camera.available_cameras, [{"id": 0}, {"id": 2}])
        handles[0].release.assert_called_once()
        handles[2].release.assert_called_once()

    def test_start_passes_session_data_and_shares_state_with_websocket(self):
        self.app.dependency_overrides[self.verify_token] = lambda: {"id": "user-1"}
        self.database.supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[{"teacher_id": "teacher-1"}])
        self.camera.available_cameras.append({"id": 0})
        thread = MagicMock()
        with patch.object(self.camera, "CameraThread", return_value=thread) as constructor:
            response = self.client.get("/api/camera/start-all?subject_id=CS101&group=1")
        self.assertEqual(response.json(), {"message": "Started 1 cameras", "started": ["0"]})
        constructor.assert_called_once_with("0", teacher_id="teacher-1", subject_id="CS101", group="1")
        thread.start.assert_called_once()
        self.assertTrue(thread.detecting)
        self.assertIs(self.camera.camera_threads, self.stream.camera_threads)
        self.assertIs(self.camera.camera_threads, self.core.camera_threads)
        self.assertIs(self.stream.camera_threads["0"], thread)

    def test_stop_and_close_keep_existing_partial_summary_sequence(self):
        thread = MagicMock()
        thread.interval_results = ["Looking at the board"]
        self.camera.camera_threads["0"] = thread
        self.assertEqual(self.client.get("/api/camera/stop-all").json(), {"message": "Stopped detection for all cameras"})
        self.assertFalse(thread.detecting)
        response = self.client.get("/api/camera/close-all")
        self.assertEqual(response.json(), {"message": "All camera threads closed"})
        self.assertEqual([call[0] for call in thread.mock_calls], ["save_summary", "reset_state", "stop"])
        self.assertEqual(self.camera.camera_threads, {})

    def test_login_returns_existing_teacher_fields(self):
        db = self.database.supabase_client
        teacher = {"id": "user-1", "first_name": "Test", "last_name": "Teacher", "major_id": "CS"}
        db.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            SimpleNamespace(data=[teacher]), SimpleNamespace(data=[{"major_name": "Computing"}]),
        ]
        db.auth.admin.list_users.return_value = [SimpleNamespace(id="user-1", email="test@example.invalid")]
        db.auth.sign_in_with_password.return_value = SimpleNamespace(session=SimpleNamespace(access_token="fake-access", refresh_token="fake-refresh"))
        response = self.client.post("/api/auth/login-by-id", data={"teacher_id": "T001", "password": "test-password"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "status": "success", "role": "teacher", "teacher_id": "T001",
            "fullname": "Test Teacher", "major": "Computing",
            "access_token": "fake-access", "refresh_token": "fake-refresh",
        })

    def test_login_failure_keeps_existing_error(self):
        self.database.supabase_client.table.side_effect = RuntimeError("fake database failure")
        response = self.client.post("/api/auth/login-by-id", data={"teacher_id": "T001", "password": "test-password"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "รหัสประจำตัว / รหัสผ่านไม่ถูกต้อง")

    def test_create_teacher_preserves_profile_mapping(self):
        db = self.database.supabase_admin
        db.auth.admin.create_user.return_value = SimpleNamespace(user=SimpleNamespace(id="new-user"))
        db.table.return_value.insert.return_value.execute.return_value = SimpleNamespace(data=[{"id": "new-user"}])
        response = self.client.post("/api/admin/create-teacher", json={
            "email": "test@example.invalid", "password": "test-password", "teacher_id": "T001",
            "fullname": "Test Teacher Name", "major_id": "CS",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "success", "detail": "เพิ่มอาจารย์เสร็จสิ้น"})
        db.table.return_value.insert.assert_called_once_with({
            "id": "new-user", "teacher_id": "T001", "first_name": "Test",
            "last_name": "Teacher Name", "major_id": "CS",
        })

    def test_empty_upload_preserves_response(self):
        with patch.object(self.summary, "get_all_pending_files", return_value=[]):
            response = self.client.get("/api/camera/summary-to-supabase")
        self.assertEqual(response.json(), {"message": "ไม่มีข้อมูลค้างอยู่", "inserted": 0})

    def test_upload_preserves_rows_and_only_removes_completed_buffer(self):
        data = {
            "camera_id": 1, "teacher_id": "T001", "subject_id": " CS101 ", "group": "1", "session_id": 123,
            "records": [{"created_at": "2026-10-16T10:00:00+07:00", "Attention": 0.75, "Non_Attention": 0.25,
                         "class_json": {"Looking at the board": 0.75, "Using Phone": 0.25},
                         "class_duration": {"Looking at the board": 45.0, "Using Phone": 15.0}}],
        }
        for fails in (False, True):
            with self.subTest(summary_insert_fails=fails), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "buffer.json"
                path.write_text(json.dumps(data), encoding="utf-8")
                db = MagicMock()
                logs, summaries = MagicMock(), MagicMock()
                db.table.side_effect = lambda name: logs if name == "camera_logs" else summaries
                if fails:
                    summaries.insert.return_value.execute.side_effect = RuntimeError("fake summary failure")
                with patch.object(self.summary, "supabase_client", db), patch.object(self.summary, "get_all_pending_files", return_value=[str(path)]):
                    response = self.client.get("/api/camera/summary-to-supabase")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["inserted"], 1)
                self.assertEqual(path.exists(), fails)
                self.assertEqual(logs.insert.call_args.args[0][0]["subject_id"], "CS101")
                daily = summaries.insert.call_args.args[0]
                self.assertEqual(daily["session_id"], 123)
                self.assertEqual(daily["avg_attention"], 0.75)
                self.assertEqual(daily["class_duration_summary"], data["records"][0]["class_duration"])

    def test_summary_math_keeps_current_record_average(self):
        # Characterize the current formula; changing weighting is a separate change.
        records = [
            {"created_at": "2026-10-16T10:00:00+07:00", "Attention": 1.0, "class_duration": {"board": 60}},
            {"created_at": "2026-10-16T10:00:06+07:00", "Attention": 0.0, "class_duration": {"phone": 6}},
        ]
        date, attention, _, _, durations = self.summary._calculate_summary(records, 2)
        self.assertEqual(date, "2026-10-16")
        self.assertEqual(attention, 0.5)
        self.assertEqual(durations, {"board": 60.0, "phone": 6.0})

    def test_summary_websocket_keeps_existing_path_and_missing_camera_close(self):
        with self.client.websocket_connect("/api/camera/ws/camera/summary/999") as websocket:
            with self.assertRaises(WebSocketDisconnect):
                websocket.receive_json()


if __name__ == "__main__":
    unittest.main()
