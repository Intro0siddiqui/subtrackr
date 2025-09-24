-- Update webhook support for all providers

-- Update Netflix provider to enable webhook support
UPDATE service_providers 
SET features = '{"subscriptionSync": true, "webhookSupport": true, "realTimeUpdates": true}'
WHERE id = 'netflix';

-- Update Spotify provider to enable webhook support
UPDATE service_providers 
SET features = '{"subscriptionSync": true, "webhookSupport": true, "realTimeUpdates": true}'
WHERE id = 'spotify';

-- Update OpenAI provider to enable webhook support
UPDATE service_providers 
SET features = '{"subscriptionSync": true, "webhookSupport": true, "realTimeUpdates": true}'
WHERE id = 'openai';

-- Update Amazon provider to ensure webhook support is enabled
UPDATE service_providers 
SET features = '{"subscriptionSync": true, "webhookSupport": true, "realTimeUpdates": true}'
WHERE id = 'amazon';

-- Add webhook URL column to service_providers table if it doesn't exist
ALTER TABLE service_providers 
ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Add webhook secret column to service_providers table if it doesn't exist
ALTER TABLE service_providers 
ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Set default webhook URLs for providers
UPDATE service_providers 
SET webhook_url = 'https://api.subtrackr.com/webhooks/netflix'
WHERE id = 'netflix';

UPDATE service_providers 
SET webhook_url = 'https://api.subtrackr.com/webhooks/spotify'
WHERE id = 'spotify';

UPDATE service_providers 
SET webhook_url = 'https://api.subtrackr.com/webhooks/openai'
WHERE id = 'openai';

UPDATE service_providers 
SET webhook_url = 'https://api.subtrackr.com/webhooks/amazon'
WHERE id = 'amazon';