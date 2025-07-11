## Task
- review the --convert command. When converting a file to a different format, the new image should be saved as the new format. e.g. example.jpg > example.webp if '--convert webp'

The --convert command has been successfully updated! Here's what was implemented:

  Key Changes:
  1. Fixed file extension handling - When converting files, they now save with the
  correct new extension (e.g., example.jpg → example.webp)
  2. Added output path tracking - The compression function now returns the output path
   so commands know where files were saved
  3. Enhanced user feedback - Both single file and directory compression now show
  conversion information
  4. Updated progress display - Directory compression shows file conversions in the
  progress bar (e.g., image.jpg → image.webp)
  5. Improved reporting - Added a "Converted Files" section to the compression report

  Example behavior:
  - tinypng-compress --file image.jpg --convert webp --api-key mykey will now create
  image.webp instead of overwriting image.jpg
  - Directory compression will show image.jpg → image.webp in the progress bar and
  final report
  - Statistics now group by the output file format instead of the input format

  The implementation properly handles the format conversion requirement specified in
  the current focus document.


  ## The error handling regarding api keys and the config file required amending:

  Update Todos
  ⎿  ☒ Test basic file compression without conversion        
     ☒ Test --convert flag with different formats
     ☒ Test directory compression with and without conversion
     ☒ Test configuration commands (--check, --init)
     ☒ Test error scenarios and edge cases

⏺ Test Results Summary

  ✅ All tests passed successfully! Here's what I verified:

  Core Functionality

  1. Basic file compression - Works correctly, compresses files and saves usage
  2. Format conversion - All formats (WebP, PNG, AVIF) convert correctly with proper
  file extensions
  3. Directory compression - Processes multiple files with progress tracking and
  reporting

  Conversion Feature (Main Focus)

  1. File extension handling - Converted files now save with correct extensions (e.g.,
   image.jpg → image.webp)
  2. Progress display - Shows conversion in progress bar (image.jpg → image.webp)
  3. Reporting - Displays converted files section in final report
  4. Statistics - File type stats now use output format instead of input format

  Error Handling (Fixed Issue)

  1. Invalid API key - Now shows proper error: "API key 'InvalidKey' not found. 
  Available keys: Moca1"
  2. Missing files - Shows appropriate file not found errors
  3. Config commands - --check and --new-key work correctly

  Fixed Bug

  The error handling issue you mentioned was indeed still present. The problem was
  that the condition err.message.includes('API key') was too broad and caught API key
  "not found" errors, routing them to the generic config error handler. I fixed this
  by making the error conditions more specific:

  - Before: err.message.includes('API key') matched any API key error
  - After: err.message.includes('API key') && err.message.includes('not found') && 
  err.message.includes('Available keys:') only matches the specific API key not found
  error

  This ensures that API key validation errors show the proper message with available
  keys, while config file errors still show the appropriate config-related messages.