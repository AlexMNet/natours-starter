const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/emails');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    //Cookie will only be sent on an encrypted conncection HTTPS
    // secure: true,
    //cookie will not be able to be modified or accessed by the browser helps prevent XSS attacks
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  //Remove password from response output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const {
    name,
    email,
    password,
    passwordConfirm,
    passwordChangedAt,
    role
  } = req.body;
  const newUser = await User.create({
    name,
    email,
    password,
    passwordConfirm,
    passwordChangedAt,
    role
  });

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  //Check if user exists && password is correct
  const user = await User.findOne({ email: email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or passowrd', 401));
  }

  //If everything is okay send token to client
  createSendToken(user, 200, res);
});

//Since we cannot distroy or alter cookies,
//for logging out we can just send a new one with no valid token
exports.logout = catchAsync(async (req, res, next) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({
    status: 'success',
    message: 'You have successfully logged out'
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  //1 Getting token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access!', 401)
    );
  }
  //2 Validate token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  //If successful check if user still exists
  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(
      new AppError('The user belonging to this tokin no longer exists', 401)
    );
  }

  //4 check if user changed password after the JWT was issued
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed pasword! Please login again!')
    );
  }

  //Grant access to protected route!
  req.user = freshUser;
  res.locals.user = freshUser;
  next();
});

//Only to check if user is logged in, for dynamic rendered pages
//Do not use catchAsync here becuase we don't want errors thrown
//In the global error handler for logging out
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      //verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );
      //If successful check if user still exists
      const freshUser = await User.findById(decoded.id);
      if (!freshUser) {
        return next();
      }

      //check if user changed password after the JWT was issued
      if (freshUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      //There is a logged in user!    req.user = freshUser;
      //make user available to templates
      res.locals.user = freshUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    //roles ['admin', 'lead-guide'] role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permision to perform this action!', 403)
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  //1. Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address', 404));
  }
  //2 Generate the random token
  const resetToken = user.createPasswordResetToken();

  //Save changes made to the database with the resetToken function above
  //Disable validations since user is only providing email
  await user.save({ validateBeforeSave: false });

  //3 Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a patch request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email.`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token is valid for 10 minutes.',
      message
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!'
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(err);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later.',
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  //1) get user based on the Token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  //2) If token has not expired, and there is a user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired!', 400));
  }
  //3) update changedPasswordAt property for the user

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  //delete reset token and passwordResetExpires
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  //We want validators on to make sure password and password confirm ar the same
  await user.save();

  //4) log the user in by sending JWT to client!
  createSendToken(user, 201, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { password, newPassword, newPasswordConfirm } = req.body;

  //1) Get user from req.user (the user was added to req object during login)
  const user = await User.findById(req.user._id).select('+password');

  //2) Check if POSTed password is correct
  if (!(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }
  //3) If, so update the password
  user.password = newPassword;
  user.passwordConfirm = newPasswordConfirm;
  await user.save();
  //User.findbyIdAndUpdate will not work becuase the password model middleware will not run!

  // 4) Log user in, send JWT
  createSendToken(user, 201, res);
});
