# PHASE 3.5 - enhancements

## Active References
- docs/config-structure.md
- docs/commands-spec.md
- docs/api-reference.md
- docs/file-operations.md
- docs/error-handling.md

## Tasks
default options for tinypng-compress e.g. tinpng-compress --dir ./images
defaults to: first api-key with enough available transforms. (perhaps this would be --api-key any)
defaults to: converts to the same file format of the targeted image (perhaps --convert auto would be the correct option?)

## Previous recent phase implementation notes for review
- reference/focus-history/* for previous phase implementation notes


## Tasks to be completed soon - ignore these tasks for now
- ignore: when '--api-key' is not specified, the default should be to use the next available api key with enough available compressions remaining
- ignore: max file widths or heights for resizing?
- ignore: the --recursive option moves all files to ./original but does not retain the original folder directory tree structure. All files are moved into a flat ./original/[filename]
- ignore: default options for tinypng-compress e.g. tinpng-compress --dir ./images
defaults to: first api-key with enough available transforms. (perhaps this would be --api-key any)
defaults to: converts to the same file format of the targeted image (perhaps --convert auto would be the correct option?)
