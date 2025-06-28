from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
import enum

db = SQLAlchemy()

class MessageType(enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"

class DeleteType(enum.Enum):
    FOR_ME = "for_me"
    FOR_EVERYONE = "for_everyone"

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    profile_image = db.Column(db.String(200), default='default.jpg')
    active = db.Column(db.Boolean, default=True)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    sent_messages = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender', lazy='dynamic')
    received_messages = db.relationship('Message', foreign_keys='Message.receiver_id', backref='receiver', lazy='dynamic')
    
    def __init__(self, username=None, email=None, first_name=None, last_name=None, **kwargs):
        super().__init__(**kwargs)
        if username:
            self.username = username
        if email:
            self.email = email
        if first_name:
            self.first_name = first_name
        if last_name:
            self.last_name = last_name
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_display_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username
    
    def is_online(self):
        return self.last_seen and (datetime.utcnow() - self.last_seen).seconds < 300  # 5 minutes
    
    def __repr__(self):
        return f'<User {self.username}>'

class Message(db.Model):
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text)
    message_type = db.Column(db.Enum(MessageType), default=MessageType.TEXT)
    file_url = db.Column(db.String(500))  # For images/videos
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    is_read = db.Column(db.Boolean, default=False)
    is_edited = db.Column(db.Boolean, default=False)
    edited_at = db.Column(db.DateTime)
    
    # Deletion tracking
    deleted_for_sender = db.Column(db.Boolean, default=False)
    deleted_for_receiver = db.Column(db.Boolean, default=False)
    deleted_for_everyone = db.Column(db.Boolean, default=False)
    
    # Reactions
    reactions = db.relationship('MessageReaction', backref='message', lazy='dynamic', cascade='all, delete-orphan')
    
    def __init__(self, sender_id=None, receiver_id=None, content=None, message_type=None, file_url=None, **kwargs):
        super().__init__(**kwargs)
        if sender_id is not None:
            self.sender_id = sender_id
        if receiver_id is not None:
            self.receiver_id = receiver_id
        if content is not None:
            self.content = content
        if message_type is not None:
            self.message_type = message_type
        if file_url is not None:
            self.file_url = file_url
    
    def delete_for_user(self, user_id, delete_type):
        """Delete message for specific user or everyone"""
        if delete_type == DeleteType.FOR_EVERYONE:
            self.deleted_for_everyone = True
        elif user_id == self.sender_id:
            self.deleted_for_sender = True
        elif user_id == self.receiver_id:
            self.deleted_for_receiver = True
        db.session.commit()
    
    def is_visible_to_user(self, user_id):
        """Check if message is visible to specific user"""
        if self.deleted_for_everyone:
            return False
        if user_id == self.sender_id and self.deleted_for_sender:
            return False
        if user_id == self.receiver_id and self.deleted_for_receiver:
            return False
        return True
    
    def get_reactions_summary(self):
        """Get summary of reactions for this message"""
        reactions = {}
        for reaction in self.reactions.all():
            emoji = reaction.emoji
            if emoji not in reactions:
                reactions[emoji] = []
            reactions[emoji].append(reaction.user.get_display_name())
        return reactions
    
    def __repr__(self):
        return f'<Message {self.id}: {self.content[:50]}...>'

class MessageReaction(db.Model):
    __tablename__ = 'message_reactions'
    
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('messages.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    emoji = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Ensure one reaction per user per message
    __table_args__ = (db.UniqueConstraint('message_id', 'user_id', name='unique_user_reaction'),)
    
    user = db.relationship('User', backref='reactions')
    
    def __init__(self, message_id=None, user_id=None, emoji=None, **kwargs):
        super().__init__(**kwargs)
        if message_id is not None:
            self.message_id = message_id
        if user_id is not None:
            self.user_id = user_id
        if emoji is not None:
            self.emoji = emoji
    
    def __repr__(self):
        return f'<Reaction {self.emoji} by {self.user.username}>'

# Period tracking (existing)
class PeriodData(db.Model):
    __tablename__ = 'period_data'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    last_period = db.Column(db.Date)
    cycle_length = db.Column(db.Integer, default=28)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='period_data')
    
    def __init__(self, user_id=None, last_period=None, cycle_length=None, **kwargs):
        super().__init__(**kwargs)
        if user_id is not None:
            self.user_id = user_id
        if last_period is not None:
            self.last_period = last_period
        if cycle_length is not None:
            self.cycle_length = cycle_length

# Food memories (existing)
class FoodMemory(db.Model):
    __tablename__ = 'food_memories'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    place = db.Column(db.String(200), nullable=False)
    dish = db.Column(db.String(200), nullable=False)
    location = db.Column(db.String(200))
    caption = db.Column(db.Text)
    priority = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='food_memories')

# Photo memories (existing)
class PhotoMemory(db.Model):
    __tablename__ = 'photo_memories'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    caption = db.Column(db.Text)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='photo_memories')