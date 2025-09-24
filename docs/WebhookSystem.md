# Webhook System Documentation

## Overview

The webhook system provides real-time updates from external services (Netflix, Spotify, ChatGPT, Amazon Prime) to keep subscription data synchronized in Subtrackr. The system consists of several components that work together to receive, validate, process, and store webhook events.

## Architecture

The webhook system is composed of the following components:

1. **WebhookHandler** - Main webhook processing engine
2. **WebhookValidator** - Validate webhook signatures and payloads
3. **WebhookProcessor** - Process validated webhook events
4. **WebhookQueue** - Queue management for webhook events
5. **WebhookReporter** - Reporting and analytics for webhook operations

## Components

### WebhookHandler

The main entry point for webhook processing. It handles the complete webhook processing flow:

1. Receive incoming webhook HTTP requests
2. Validate signatures and payloads
3. Queue validated events for processing
4. Process events with provider-specific handlers
5. Transform event data to internal subscription format
6. Store updated subscription data in database
7. Report webhook results and update status

### WebhookValidator

Validates incoming webhook requests to ensure they are legitimate:

- Signature verification using provider-specific algorithms
- Payload integrity checks
- Timestamp validation to prevent replay attacks
- Provider-specific validation rules

### WebhookProcessor

Processes validated webhook events:

- Routes events to appropriate provider handlers
- Transforms event data to internal subscription format
- Updates subscription data in database
- Determines if a sync operation is needed

### WebhookQueue

Manages the queue of webhook events:

- Enqueuing validated events
- Dequeuing events for processing
- Managing queue size limits
- Providing queue metrics

### WebhookReporter

Handles reporting and analytics for webhook operations:

- Logging webhook events and their outcomes
- Tracking processing metrics
- Generating reports and analytics
- Monitoring system health

## Webhook Flow

1. **Receive** - Accept incoming webhook HTTP requests
2. **Validate** - Verify signature and payload integrity
3. **Queue** - Add validated events to processing queue
4. **Process** - Execute provider-specific event handling
5. **Transform** - Map event data to internal subscription format
6. **Store** - Update subscription data in database
7. **Report** - Log webhook results and update status

## Supported Providers

The webhook system supports real-time updates from the following providers:

- Netflix
- Spotify
- ChatGPT (OpenAI)
- Amazon Prime

## API Endpoints

The webhook system exposes the following endpoints:

- `POST /webhooks/netflix` - Netflix webhook endpoint
- `POST /webhooks/spotify` - Spotify webhook endpoint
- `POST /webhooks/openai` - OpenAI webhook endpoint
- `POST /webhooks/amazon` - Amazon webhook endpoint
- `GET /health` - Health check endpoint

## Database Schema

The webhook system uses the following database tables:

- `webhook_events` - Stores incoming webhook payloads for processing
- `webhook_reports` - Tracks webhook processing results and events
- `webhook_provider_configs` - Configuration for webhook provider integrations

## Integration with Sync Engine

When a webhook event is processed and requires data synchronization, the webhook system triggers a sync operation through the sync engine. This ensures that subscription data is updated in real-time when changes occur in external services.

## Error Handling

The webhook system includes comprehensive error handling:

- Retry mechanism with exponential backoff
- Error logging and reporting
- Dead letter queue for failed events
- Alerting for critical failures

## Security

The webhook system implements several security measures:

- Signature validation to ensure authenticity
- Timestamp validation to prevent replay attacks
- Rate limiting to prevent abuse
- Input validation to prevent injection attacks

## Monitoring and Analytics

The webhook system provides monitoring and analytics capabilities:

- Real-time processing metrics
- Success and failure rates
- Average processing times
- Error analysis and reporting

## Configuration

The webhook system can be configured through environment variables:

- `WEBHOOK_MAX_RETRIES` - Maximum number of retries for failed events
- `WEBHOOK_RETRY_DELAY` - Initial delay between retries (in milliseconds)
- `WEBHOOK_QUEUE_SIZE` - Maximum size of the webhook queue
- `WEBHOOK_RATE_LIMIT_RPS` - Rate limit requests per second
- `WEBHOOK_RATE_LIMIT_RPM` - Rate limit requests per minute

## Usage Examples

### Setting up Webhook Endpoints

To set up webhook endpoints with external services, you need to provide the webhook URLs:

- Netflix: `https://api.subtrackr.com/webhooks/netflix`
- Spotify: `https://api.subtrackr.com/webhooks/spotify`
- OpenAI: `https://api.subtrackr.com/webhooks/openai`
- Amazon: `https://api.subtrackr.com/webhooks/amazon`

### Processing a Webhook Event

```typescript
import { webhookHandler } from '@/services/webhook';

// Handle incoming webhook
const result = await webhookHandler.handleWebhook(
  'netflix',
  'subscription.updated',
  payload,
  signature,
  headers
);

if (result.success) {
  console.log(`Webhook processed successfully: ${result.eventId}`);
} else {
  console.error(`Webhook processing failed: ${result.error}`);
}
```

## Troubleshooting

### Common Issues

1. **Invalid Signature** - Ensure the webhook secret is correctly configured
2. **Rate Limiting** - Check if the rate limit has been exceeded
3. **Queue Full** - Monitor queue size and processing speed
4. **Database Connection** - Verify database connectivity

### Logs and Monitoring

Check the application logs for detailed error information and monitoring data.

## Future Enhancements

Planned improvements for the webhook system:

1. Enhanced retry mechanisms with more sophisticated backoff strategies
2. Improved error categorization and handling
3. Advanced analytics and reporting features
4. Better integration with alerting systems
5. Support for additional providers