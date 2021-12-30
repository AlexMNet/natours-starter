const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');

exports.getOverview = catchAsync(async (req, res, next) => {
  //1 Get tour data from collection
  const tours = await Tour.find();
  //2 Build template
  //3 render template using tour data from step 1
  res.status(200).render('overview', {
    title: 'All Tours',
    tours
  });
});

exports.getTour = catchAsync(async (req, res) => {
  //1 get the data, for the requested tour
  const { slug } = req.params;
  const tour = await Tour.findOne({ slug }).populate({
    path: 'reviews',
    fields: 'review rating user'
  });
  //2 Build Template
  //Render template using the data from step 1
  res.status(200).render('tour', {
    title: `${tour.name} tour`,
    tour
  });
});
