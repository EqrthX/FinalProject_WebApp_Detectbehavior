import pymysql

def get_connection():
    return pymysql.connect(
        host="localhost",
        user="root",
        password="",  
        database="detect_attentive",
        cursorclass=pymysql.cursors.DictCursor  # ให้ fetch เป็น dict
    )
