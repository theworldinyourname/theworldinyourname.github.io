from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed
from wtforms import StringField, PasswordField, TextAreaField, BooleanField, SelectField, IntegerField
from wtforms.validators import DataRequired, Length, Email, EqualTo, ValidationError
from models import User

class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=4, max=20)])
    password = PasswordField('Password', validators=[DataRequired()])
    remember_me = BooleanField('Remember Me')

class RegistrationForm(FlaskForm):
    username = StringField('Username', validators=[
        DataRequired(), 
        Length(min=4, max=20, message="Username must be between 4 and 20 characters")
    ])
    email = StringField('Email', validators=[DataRequired(), Email()])
    first_name = StringField('First Name', validators=[Length(max=50)])
    last_name = StringField('Last Name', validators=[Length(max=50)])
    password = PasswordField('Password', validators=[
        DataRequired(), 
        Length(min=6, message="Password must be at least 6 characters")
    ])
    password2 = PasswordField('Repeat Password', validators=[
        DataRequired(), 
        EqualTo('password', message="Passwords must match")
    ])
    
    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user is not None:
            raise ValidationError('Username already taken. Please choose a different one.')
    
    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user is not None:
            raise ValidationError('Email already registered. Please choose a different one.')

class MessageForm(FlaskForm):
    content = TextAreaField('Message', validators=[Length(max=1000)])
    file = FileField('Attach File', validators=[
        FileAllowed(['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi'], 
                   'Images and videos only!')
    ])

class ProfileForm(FlaskForm):
    first_name = StringField('First Name', validators=[Length(max=50)])
    last_name = StringField('Last Name', validators=[Length(max=50)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    profile_image = FileField('Profile Picture', validators=[
        FileAllowed(['jpg', 'jpeg', 'png', 'gif'], 'Images only!')
    ])

class FoodMemoryForm(FlaskForm):
    place = StringField('Restaurant/Place', validators=[DataRequired(), Length(max=200)])
    dish = StringField('Dish Name', validators=[DataRequired(), Length(max=200)])
    location = StringField('Location', validators=[Length(max=200)])
    caption = TextAreaField('Special Memory', validators=[Length(max=500)])
    priority = SelectField('Priority Level', 
                          choices=[(5, '⭐⭐⭐⭐⭐ Absolutely Must Have!'),
                                  (4, '⭐⭐⭐⭐ Really Love It'),
                                  (3, '⭐⭐⭐ Pretty Good'),
                                  (2, '⭐⭐ It\'s Okay'),
                                  (1, '⭐ Meh')],
                          coerce=int, default=3)

class PhotoMemoryForm(FlaskForm):
    image = FileField('Upload Photo', validators=[
        DataRequired(),
        FileAllowed(['jpg', 'jpeg', 'png', 'gif', 'webp'], 'Images only!')
    ])
    caption = TextAreaField('Caption', validators=[Length(max=500)])

class ContactForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired(), Length(max=100)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    message = TextAreaField('Message', validators=[DataRequired(), Length(max=1000)])