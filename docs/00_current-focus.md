# PHASE 3.5 - enhancements

## Active References
- docs/phase04.md
- docs/config-structure.md
- docs/commands-spec.md
- docs/api-reference.md
- docs/file-operations.md
- docs/error-handling.md

## Tasks
### Responsive image scaling - enhancements
review the document /docs/phase04.md for the previous implementation.
From my testing I have noted the below scenarios of success & failure. Please review these, and review the code to ensure successful compressions across all of the commands:

- tinypng-compress ashcross$ tinypng-compress --file ./example.png --max-size 1920 --convert webp
Original example.png 4345px x 2207px
Resulted in example.webp 4345px x 2207px
Correct compression format change, unsuccessful responsive resize

- tinypng-compress --file ./example.png --max-size 1920
Original example.png 4345px x 1914px
Resulted in example.png 1920px x 846
Correct responsive resize when no format conversion requested

- tinypng-compress --dir ./example/ --max-size 1920
Original directory: mix of png, jpg, all greater than 1920px wide
Results: png, jpg files compressed, but none of the images were resized
Did not try to test --convert format change as 'auto' did not work.



## Previous recent phase implementation notes for review
- reference/focus-history/* for previous phase implementation notes


## Tasks to be completed soon - ignore these tasks for now
- ignore: when '--api-key' is not specified, the default should be to use the next available api key with enough available compressions remaining
- ignore: the --recursive option moves all files to ./original but does not retain the original folder directory tree structure. All files are moved into a flat ./original/[filename]
