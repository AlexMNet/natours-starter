const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const APIFeatures = require('../utils/apiFeatures');

exports.deleteOne = Model =>
  catchAsync(async (req, res, next) => {
    const document = await Model.findByIdAndDelete(req.params.id);

    //Generate a 404 error for documents not found by ID
    if (!document) {
      return next(new AppError('No document found with that ID', 404));
    }
    res.status(204).json({
      status: 'success',
      data: null
    });
  });

exports.updateOne = Model =>
  catchAsync(async (req, res, next) => {
    const document = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    //Generate a 404 error for documents not found by ID
    if (!document) {
      return next(new AppError('No document found with that ID', 404));
    }
    res.status(200).json({
      status: 'success',
      data: {
        [Model.collection.collectionName]: document
      }
    });
  });

exports.createOne = Model =>
  catchAsync(async (req, res, next) => {
    const newDocument = await Model.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        [Model.collection.collectionName]: newDocument
      }
    });
  });

exports.getOne = (Model, populateOptions) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id);
    if (populateOptions) query = query.populate(populateOptions);
    const document = await query;

    //Generate a 404 error for documents not found by ID
    if (!document) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'successful',
      data: {
        [Model.collection.collectoinName]: document
      }
    });
  });

exports.getAll = Model =>
  catchAsync(async (req, res, next) => {
    //To allow nested GET reviews on tour
    const query = {};
    if (req.params.tourId) query.tour = req.params.tourId;

    //Execute query
    const features = new APIFeatures(Model.find(query), req.query)
      .filter()
      .sort()
      .limit()
      .pagination();
    const document = await features.query;

    //send Response
    res.status(200).json({
      status: 'success',
      results: document.length,
      data: {
        [Model.collection.collectionName]: document
      }
    });
  });
