import os
import sys
from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
import base64
import io
from datetime import datetime, timedelta
import json
import shutil
from pathlib import Path

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///khalid_encryption.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'khalid-secret-2024')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024

db = SQLAlchemy(app)
jwt = JWTManager(app)

# إنشاء مجلدات العمل
for folder in ['uploads', 'encrypted_files', 'decrypted_files', 'logs']:
    os.makedirs(folder, exist_ok=True)

# ============ نماذج قاعدة البيانات ============
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    theme = db.Column(db.String(20), default='dark')
    language = db.Column(db.String(10), default='ar')
    encryption_logs = db.relationship('EncryptionLog', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class EncryptionLog(db.Model):
    __tablename__ = 'encryption_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    operation = db.Column(db.String(20), nullable=False)
    file_size = db.Column(db.Integer)
    duration = db.Column(db.Float)
    encryption_method = db.Column(db.String(50))
    status = db.Column(db.String(20), default='success')
    ip_address = db.Column(db.String(45))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    details = db.Column(db.Text)

# ============ مساعدات التشفير ============
class EncryptionHelper:
    @staticmethod
    def derive_key(password: str, salt: bytes = None) -> tuple:
        if salt is None:
            salt = os.urandom(16)
        kdf = PBKDF2(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100000)
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key, salt
    
    @staticmethod
    def encrypt_file(file_path: str, password: str) -> dict:
        try:
            start_time = datetime.utcnow()
            with open(file_path, 'rb') as f:
                data = f.read()
            file_size = len(data)
            key, salt = EncryptionHelper.derive_key(password)
            f = Fernet(key)
            encrypted_data = f.encrypt(data)
            encrypted_filename = f"{file_path}.khalid"
            with open(encrypted_filename, 'wb') as f:
                f.write(salt + encrypted_data)
            duration = (datetime.utcnow() - start_time).total_seconds()
            return {'success': True, 'encrypted_file': encrypted_filename, 'file_size': file_size, 'duration': duration, 'message': 'تم تشفير الملف بنجاح'}
        except Exception as e:
            return {'success': False, 'message': f'خطأ في التشفير: {str(e)}'}
    
    @staticmethod
    def decrypt_file(encrypted_file_path: str, password: str) -> dict:
        try:
            start_time = datetime.utcnow()
            with open(encrypted_file_path, 'rb') as f:
                file_data = f.read()
            salt = file_data[:16]
            encrypted_data = file_data[16:]
            key, _ = EncryptionHelper.derive_key(password, salt)
            f = Fernet(key)
            decrypted_data = f.decrypt(encrypted_data)
            original_filename = encrypted_file_path.replace('.khalid', '')
            with open(original_filename, 'wb') as f:
                f.write(decrypted_data)
            duration = (datetime.utcnow() - start_time).total_seconds()
            return {'success': True, 'decrypted_file': original_filename, 'file_size': len(decrypted_data), 'duration': duration, 'message': 'تم فك التشفير بنجاح'}
        except Exception as e:
            return {'success': False, 'message': f'خطأ في فك التشفير: {str(e)}'}

# ============ مسارات المصادقة ============
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'البيانات مفقودة'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'اسم المستخدم موجود بالفعل'}), 409
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'البريد الإلكتروني موجود بالفعل'}), 409
    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    access_token = create_access_token(identity=user.id)
    return jsonify({'message': 'تم التسجيل بنجاح', 'access_token': access_token, 'user': {'id': user.id, 'username': user.username, 'email': user.email}}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'البيانات مفقودة'}), 400
    user = User.query.filter_by(username=data['username']).first()
    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'اسم المستخدم أو كلمة المرور غير صحيحة'}), 401
    if not user.is_active:
        return jsonify({'error': 'الحساب معطل'}), 403
    user.last_login = datetime.utcnow()
    db.session.commit()
    access_token = create_access_token(identity=user.id)
    return jsonify({'message': 'تم تسجيل الدخول بنجاح', 'access_token': access_token, 'user': {'id': user.id, 'username': user.username, 'email': user.email, 'theme': user.theme, 'language': user.language}}), 200

# ============ مسارات التشفير ============
@app.route('/api/encrypt', methods=['POST'])
@jwt_required()
def encrypt():
    user_id = get_jwt_identity()
    if 'file' not in request.files:
        return jsonify({'error': 'لم يتم تحديد ملف'}), 400
    password = request.form.get('password')
    if not password:
        return jsonify({'error': 'كلمة المرور مفقودة'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'الملف فارغ'}), 400
    try:
        temp_path = os.path.join('uploads', file.filename)
        file.save(temp_path)
        result = EncryptionHelper.encrypt_file(temp_path, password)
        if result['success']:
            log = EncryptionLog(user_id=user_id, filename=file.filename, operation='encrypt', file_size=result['file_size'], duration=result['duration'], encryption_method='Fernet-AES', status='success', ip_address=request.remote_addr, details=f"تم تشفير الملف بحجم {result['file_size']} بايت")
            db.session.add(log)
            db.session.commit()
            encrypted_path = os.path.join('encrypted_files', f"{file.filename}.khalid")
            shutil.move(result['encrypted_file'], encrypted_path)
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({'message': result['message'], 'encrypted_filename': f"{file.filename}.khalid", 'file_size': result['file_size'], 'duration': round(result['duration'], 4), 'log_id': log.id}), 200
        else:
            return jsonify({'error': result['message']}), 400
    except Exception as e:
        log = EncryptionLog(user_id=user_id, filename=file.filename if file else 'unknown', operation='encrypt', status='failed', ip_address=request.remote_addr, details=str(e))
        db.session.add(log)
        db.session.commit()
        return jsonify({'error': f'خطأ في التشفير: {str(e)}'}), 500

@app.route('/api/decrypt', methods=['POST'])
@jwt_required()
def decrypt():
    user_id = get_jwt_identity()
    if 'file' not in request.files:
        return jsonify({'error': 'لم يتم تحديد ملف'}), 400
    password = request.form.get('password')
    if not password:
        return jsonify({'error': 'كلمة المرور مفقودة'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'الملف فارغ'}), 400
    try:
        temp_path = os.path.join('uploads', file.filename)
        file.save(temp_path)
        result = EncryptionHelper.decrypt_file(temp_path, password)
        if result['success']:
            log = EncryptionLog(user_id=user_id, filename=file.filename, operation='decrypt', file_size=result['file_size'], duration=result['duration'], encryption_method='Fernet-AES', status='success', ip_address=request.remote_addr, details=f"تم فك تشفير الملف بحجم {result['file_size']} بايت")
            db.session.add(log)
            db.session.commit()
            original_name = file.filename.replace('.khalid', '')
            decrypted_path = os.path.join('decrypted_files', original_name)
            shutil.move(result['decrypted_file'], decrypted_path)
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({'message': result['message'], 'decrypted_filename': original_name, 'file_size': result['file_size'], 'duration': round(result['duration'], 4), 'log_id': log.id}), 200
        else:
            return jsonify({'error': result['message']}), 400
    except Exception as e:
        log = EncryptionLog(user_id=user_id, filename=file.filename if file else 'unknown', operation='decrypt', status='failed', ip_address=request.remote_addr, details=str(e))
        db.session.add(log)
        db.session.commit()
        return jsonify({'error': f'خطأ في فك التشفير: {str(e)}'}), 500

# ============ مسارات الإعدادات ============
@app.route('/api/user/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'المستخدم غير موجود'}), 404
    return jsonify({'id': user.id, 'username': user.username, 'email': user.email, 'created_at': user.created_at.isoformat(), 'last_login': user.last_login.isoformat() if user.last_login else None, 'theme': user.theme, 'language': user.language}), 200

@app.route('/api/user/update', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'المستخدم غير موجود'}), 404
    data = request.get_json()
    if 'email' in data:
        if User.query.filter_by(email=data['email']).filter(User.id != user_id).first():
            return jsonify({'error': 'البريد الإلكتروني مستخدم بالفعل'}), 409
        user.email = data['email']
    if 'theme' in data:
        user.theme = data['theme']
    if 'language' in data:
        user.language = data['language']
    db.session.commit()
    return jsonify({'message': 'تم تحديث البيانات بنجاح'}), 200

@app.route('/api/user/change-password', methods=['POST'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'المستخدم غير موجود'}), 404
    data = request.get_json()
    if not data.get('old_password') or not data.get('new_password'):
        return jsonify({'error': 'البيانات مفقودة'}), 400
    if not user.check_password(data['old_password']):
        return jsonify({'error': 'كلمة المرور الحالية غير صحيحة'}), 401
    if len(data['new_password']) < 6:
        return jsonify({'error': 'كلمة المرور الجديدة قصيرة جداً'}), 400
    user.set_password(data['new_password'])
    db.session.commit()
    return jsonify({'message': 'تم تغيير كلمة المرور بنجاح'}), 200

# ============ مسارات السجلات ============
@app.route('/api/logs', methods=['GET'])
@jwt_required()
def get_logs():
    user_id = get_jwt_identity()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    logs = EncryptionLog.query.filter_by(user_id=user_id).order_by(EncryptionLog.timestamp.desc()).paginate(page=page, per_page=per_page)
    return jsonify({'logs': [{'id': log.id, 'filename': log.filename, 'operation': log.operation, 'file_size': log.file_size, 'duration': log.duration, 'encryption_method': log.encryption_method, 'status': log.status, 'timestamp': log.timestamp.isoformat(), 'details': log.details} for log in logs.items], 'total': logs.total, 'pages': logs.pages, 'current_page': page}), 200

# ============ المسارات الرئيسية ============
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'الصفحة غير موجودة'}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'خطأ داخلي في الخادم'}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=False, host='0.0.0.0', port=5000)