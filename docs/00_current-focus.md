# PHASE 3.5 - enhancements

## Active References
- docs/config-structure.md
- docs/commands-spec.md
- docs/api-reference.md
- docs/file-operations.md
- docs/error-handling.md

## Tasks
Add a 'max size' option '--max-size' which should be the maximum px size of either the width or the height of the image.
default: '--max-side auto' : finds the largest dimension of the image (which will be either width or height) and scales the image based on the largest of the dimensions, according to the --max-size option
Example: '--max-side width' : responsively scales the images based on the width
Example: '--max-size height' : responsively scales images based on the height

default: '--max-size none' : this does not attempt to resize them image during compression
example: '--max-size 1920' : The current image is reviewed to find the largest dimension of the image (which will be decided by the '--max-side' option, either auto, width, or height) and if that number exceeds 1920, the image is auto scaled down based on that dimension


## Previous recent phase implementation notes for review
- reference/focus-history/* for previous phase implementation notes


## Tasks to be completed soon - ignore these tasks for now
- ignore: when '--api-key' is not specified, the default should be to use the next available api key with enough available compressions remaining
- ignore: the --recursive option moves all files to ./original but does not retain the original folder directory tree structure. All files are moved into a flat ./original/[filename]
