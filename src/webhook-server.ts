import express, { Request, Response } from 'express';
import { webhookHandler } from './services/webhook';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware to parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Webhook endpoint for Netflix
app.post('/webhooks/netflix', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-netflix-signature'] as string;
    const result = await webhookHandler.handleWebhook(
      'netflix',
      req.body.event_type || 'unknown',
      req.body,
      signature,
      req.headers
    );
    
    if (result.success) {
      res.status(200).json({ 
        success: true, 
        message: 'Webhook processed successfully',
        eventId: result.eventId 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Netflix webhook error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Webhook endpoint for Spotify
app.post('/webhooks/spotify', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-spotify-signature'] as string;
    const result = await webhookHandler.handleWebhook(
      'spotify',
      req.body.event_type || 'unknown',
      req.body,
      signature,
      req.headers
    );
    
    if (result.success) {
      res.status(200).json({ 
        success: true, 
        message: 'Webhook processed successfully',
        eventId: result.eventId 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Spotify webhook error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Webhook endpoint for OpenAI
app.post('/webhooks/openai', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['openai-signature'] as string;
    const result = await webhookHandler.handleWebhook(
      'openai',
      req.body.event_type || 'unknown',
      req.body,
      signature,
      req.headers
    );
    
    if (result.success) {
      res.status(200).json({ 
        success: true, 
        message: 'Webhook processed successfully',
        eventId: result.eventId 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('OpenAI webhook error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Webhook endpoint for Amazon
app.post('/webhooks/amazon', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-amz-signature'] as string;
    const result = await webhookHandler.handleWebhook(
      'amazon',
      req.body.event_type || 'unknown',
      req.body,
      signature,
      req.headers
    );
    
    if (result.success) {
      res.status(200).json({ 
        success: true, 
        message: 'Webhook processed successfully',
        eventId: result.eventId 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Amazon webhook error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Initialize webhook handler
async function initializeWebhookSystem() {
  try {
    await webhookHandler.initialize();
    console.log('Webhook system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize webhook system:', error);
    process.exit(1);
  }
}

// Start the server
async function startServer() {
  await initializeWebhookSystem();
  
  app.listen(PORT, () => {
    console.log(`Webhook server is running on port ${PORT}`);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await webhookHandler.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await webhookHandler.shutdown();
  process.exit(0);
});

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default app;