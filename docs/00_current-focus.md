# PHASE 3.5 - enhancements

## Active References
- docs/phase04.md
- docs/config-structure.md
- docs/commands-spec.md
- docs/api-reference.md
- docs/file-operations.md
- docs/error-handling.md

## Tasks
### Global Install isn't properly linking the executable
tinypng-compress —dir ~/test

The above works when I’m inside the project directory, but does not work from outside of it.

Example:
cd ~
tinypng-compress --file ~/Downloads/grass.jpg --max-side height --max-size 1600 --convert avif
Error: Error: Configuration file not found

Suggestion: Run 'tinypng-compress --init' to create a configuration file.




## Previous recent phase implementation notes for review
- reference/focus-history/* for previous phase implementation notes


## Tasks to be completed soon - ignore these tasks for now
- ignore: fix the sym link for 'tinypng-compress' so that it can be used globally. Right now I need to use npm link manually to get it to work, I want it fixed as part of the npm i -g .
- ignore: add a skip file option when compressing a directory. Add the name/path of files that have been compressed already to this skip file. Then running the compress command next month would skip the 500 files that have already compressed from last month
- ignore: update all documentation regarding the recent responsive image resizing features, including terminal progress and review text during commands
- ignore: when '--api-key' is not specified, the default should be to use the next available api key with enough available compressions remaining
- ignore: the --recursive option moves all files to ./original but does not retain the original folder directory tree structure. All files are moved into a flat ./original/[filename]
