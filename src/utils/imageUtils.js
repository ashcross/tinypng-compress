import { imageSize } from 'image-size';
import fs from 'fs';

export function getImageDimensions(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const dimensions = imageSize(buffer);
    return {
      width: dimensions.width,
      height: dimensions.height,
      success: true
    };
  } catch (error) {
    return {
      width: null,
      height: null,
      success: false,
      error: error.message
    };
  }
}

export function calculateResizeDimensions(originalWidth, originalHeight, maxSize, maxSide) {
  if (maxSize === 'none' || !maxSize) {
    return null;
  }
  
  const maxSizeNumber = parseInt(maxSize, 10);
  if (isNaN(maxSizeNumber) || maxSizeNumber <= 0) {
    return null;
  }
  
  let dimensionToCheck;
  let otherDimension;
  let isWidthPrimary;
  
  switch (maxSide) {
    case 'width':
      dimensionToCheck = originalWidth;
      otherDimension = originalHeight;
      isWidthPrimary = true;
      break;
    case 'height':
      dimensionToCheck = originalHeight;
      otherDimension = originalWidth;
      isWidthPrimary = false;
      break;
    case 'auto':
    default:
      if (originalWidth >= originalHeight) {
        dimensionToCheck = originalWidth;
        otherDimension = originalHeight;
        isWidthPrimary = true;
      } else {
        dimensionToCheck = originalHeight;
        otherDimension = originalWidth;
        isWidthPrimary = false;
      }
      break;
  }
  
  if (dimensionToCheck <= maxSizeNumber) {
    return null;
  }
  
  const scaleFactor = maxSizeNumber / dimensionToCheck;
  const newPrimaryDimension = maxSizeNumber;
  const newSecondaryDimension = Math.round(otherDimension * scaleFactor);
  
  if (isWidthPrimary) {
    return {
      width: newPrimaryDimension,
      height: newSecondaryDimension,
      scaleFactor,
      primaryDimension: 'width'
    };
  } else {
    return {
      width: newSecondaryDimension,
      height: newPrimaryDimension,
      scaleFactor,
      primaryDimension: 'height'
    };
  }
}

export function createTinyPngResizeOptions(resizeDimensions) {
  if (!resizeDimensions) {
    return null;
  }
  
  return {
    method: 'scale',
    [resizeDimensions.primaryDimension]: resizeDimensions[resizeDimensions.primaryDimension]
  };
}

export function shouldResize(maxSize) {
  return maxSize && maxSize !== 'none';
}