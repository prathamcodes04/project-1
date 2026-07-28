export const catchAsyncErrors = (theFunction) => {
  return (req, res, next) => {
    //pass error to express if fails
    Promise.resolve(theFunction(req, res, next)).catch(next);
  };
};
