# PHASE 3.5 - enhancements

## Active References
- docs/config-structure.md
- docs/commands-spec.md
- docs/api-reference.md
- docs/file-operations.md
- docs/error-handling.md

## Tasks
I need to enhance my tinypng-compression with efficient batch processing capabilities for better throughput while respecting TinyPNG API rate limits.

Current implementation: Single file → API call → save → next file

Desired enhancement: Batch upload multiple files to TinyPNG API, process them concurrently (with rate limiting), and download compressed results efficiently.

Key requirements:
1. Concurrent processing with configurable max simultaneous requests (default 3-5)
2. Respect TinyPNG rate limits with request delays
3. Progress tracking for large batches
4. Graceful error handling - continue processing other files if one fails
5. Memory efficient for large file batches
6. Maintain existing file backup and organization logic

Technical constraints:
- TinyPNG API has generous but unspecified rate limits
- Need to balance speed vs API courtesy
- Handle network timeouts and retries gracefully
- Update compression count tracking accurately across concurrent requests

Please implement the batch processing logic with proper concurrency control, error handling, and progress reporting. Focus on the core batch processing function that can replace my current sequential loop.

## Previous recent phase implementation notes for review
- reference/focus-history/* for previous phase implementation notes


## Tasks to be completed soon - ignore these tasks for now
- ignore: when '--api-key' is not specified, the default should be to use the next available api key with enough available compressions remaining
- ignore: max file widths or heights for resizing?
- did a batch run, looks like the .jpg files were not removed when the .avif files were created. It was also really slow, so I'd like to see logs to see if any efficient batch processing has actually been implemented