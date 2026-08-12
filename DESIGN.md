# Design

## Overview

A Redis-backed background job processor with retries, backoff, dead-lettering.

## Why a task queue

Jobs can fail and be retried rather than needing the succeed synchronously the moment they are recieved.

## Architecture decisions

### Producer/Worker as seperate processes
Each has their own instructions, Producer adds jobs where as the Worker doesn't need to import Producer but use the Broker (Redis) to receive those jobs.

### LPUSH + RPOP for FIFO ordering
When a job gets added we want to treat is as if its a queue where the first job in is the first job to be executed by the worker.

### The handler registry pattern
This task queue used a lookup object that was used to call the handler for that job type. This was used over something like an if/else chain for scalibility if more job types were added the object scales much better.

### Serperating HandlerError from infra errors
To determine what went wrong while in the worker process errors were split up from the infrastructure failure, and the actual business logic to better understand what and where went wrong.

## Failure handling

### Retry logic
Attempts were tracked by adding a key and value pair of attempts into the job object, to determine the max retries cutoff. This was chosen to determine the attempts state since each job attempts couldn't be stored within the process.

### Dead-letter queue
After a job has been retried three times the job is sent into a dead-letter queue which includes an error message of what went wrong.

### Exponential backoff
Exponential backoff is included in three places in the worker process (empty poll, handler retry, infra failure), ensuring the system isn't constantly trying something that is failing without pausing.

### Bounded error logging (LTRIM)
LTRIM was implemented to keep Errors capped at a fixed size rather than unbounded growth.

## Known limitations
The worker is single looped and doesn't execute jobs while paused which the next improvement concurrency would fix.

## Improvements
Concurrency