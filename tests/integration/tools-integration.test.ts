import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import {
  createSaveCheckpointTool,
  createLoadContextTool,
  createGetAnchorsTool,
  configureStorage,
} from '../../src/tools';

describe('Tools Integration', () => {
  let testStoragePath: string;

  beforeEach(async () => {
    // Create a temporary test storage directory
    testStoragePath = path.join(
      os.tmpdir(),
      `choff-integration-test-${Date.now()}`,
    );
    await fs.mkdir(testStoragePath, { recursive: true });

    // Configure storage to use test directory
    configureStorage({
      storagePath: path.join(testStoragePath, 'test-conversations.json'),
    });
  });

  afterEach(async () => {
    // Clean up test storage directory
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should save checkpoint and load context back', async () => {
    const saveCheckpoint = createSaveCheckpointTool();
    const loadContext = createLoadContextTool();

    // Save a conversation
    const saveResult = await saveCheckpoint.handler({
      content: `{state:focused}[context:architecture]
I've decided to use PostgreSQL for our database.
We were {state:blocked} by the ORM compatibility issues.
Found a {state:eureka} solution: using Prisma as our ORM!
&pattern:question|open| Should we also add Redis for caching?`,
      extractAnchors: true,
      generateSummary: true,
    });

    expect(saveResult.success).toBe(true);
    const checkpointId = (saveResult.data as any).checkpointId;
    expect(checkpointId).toBeDefined();

    // Load the context back
    const loadResult = await loadContext.handler({
      query: 'database',
      maxTokens: 1000,
    });

    expect(loadResult.success).toBe(true);
    const contexts = (loadResult.data as any).contexts;
    expect(contexts.length).toBe(1);
    expect(contexts[0].content).toContain('PostgreSQL');
    expect(contexts[0].summary).toBeDefined();
    expect(contexts[0].tags).toContain('context:architecture');
  });

  it('should extract anchors from saved conversations', async () => {
    const saveCheckpoint = createSaveCheckpointTool();
    const getAnchors = createGetAnchorsTool();

    // Save multiple conversations
    await saveCheckpoint.handler({
      content: `{state:decisive} Choosing React for the frontend framework.`,
      extractAnchors: true,
    });

    await saveCheckpoint.handler({
      content: `{state:blocked} Cannot proceed without API keys.`,
      extractAnchors: true,
    });

    await saveCheckpoint.handler({
      content: `{state:eureka} Discovered we can use environment variables!`,
      extractAnchors: true,
    });

    // Get all anchors from storage
    const anchorResult = await getAnchors.handler({
      limit: 10,
    });

    expect(anchorResult.success).toBe(true);
    const data = anchorResult.data as any;
    expect(data.anchors.length).toBeGreaterThan(0);
    expect(data.source).toBe('stored_conversations');

    // Check we have different anchor types
    const anchorTypes = new Set(data.anchors.map((a: any) => a.type));
    expect(anchorTypes.has('decision')).toBe(true);
    expect(anchorTypes.has('blocker')).toBe(true);
    expect(anchorTypes.has('breakthrough')).toBe(true);
  });

  it('should filter anchors by type', async () => {
    const saveCheckpoint = createSaveCheckpointTool();
    const getAnchors = createGetAnchorsTool();

    // Save conversation with various anchor types
    await saveCheckpoint.handler({
      content: `{state:decisive} We'll use TypeScript.
{state:blocked} Missing type definitions.
{state:curious} What about using Zod for runtime validation?
{state:eureka} Found DefinitelyTyped has the types we need!`,
      extractAnchors: true,
    });

    // Get only questions
    const questionResult = await getAnchors.handler({
      type: 'question',
    });

    expect(questionResult.success).toBe(true);
    const questionData = questionResult.data as any;
    const questionAnchors = questionData.anchors.filter(
      (a: any) => a.type === 'question',
    );
    expect(questionAnchors.length).toBeGreaterThan(0);
    expect(questionAnchors.every((a: any) => a.type === 'question')).toBe(true);

    // Get only decisions
    const decisionResult = await getAnchors.handler({
      type: 'decision',
    });

    expect(decisionResult.success).toBe(true);
    const decisionData = decisionResult.data as any;
    const decisionAnchors = decisionData.anchors.filter(
      (a: any) => a.type === 'decision',
    );
    expect(decisionAnchors.length).toBeGreaterThan(0);
    expect(decisionAnchors.every((a: any) => a.type === 'decision')).toBe(true);
  });

  it('should load only anchors when anchorsOnly is true', async () => {
    const saveCheckpoint = createSaveCheckpointTool();
    const loadContext = createLoadContextTool();

    // Save a long conversation
    const longContent = `{state:analytical}[context:planning]
This is a very long conversation about system architecture.
We made several important decisions today.
{state:decisive} First, we chose microservices architecture.
There were many considerations involved in this choice.
{state:decisive} Second, we selected Kubernetes for orchestration.
This will help us with scalability and deployment.
{state:blocked} However, we're stuck on the messaging system choice.
Should we use RabbitMQ or Kafka? Each has its pros and cons.
{state:curious} What are the latency requirements for our system?
This will heavily influence our technology choices.
`.repeat(5); // Make it longer

    await saveCheckpoint.handler({
      content: longContent,
      extractAnchors: true,
      generateSummary: true,
    });

    // Load only anchors
    const anchorResult = await loadContext.handler({
      anchorsOnly: true,
      maxTokens: 500,
    });

    expect(anchorResult.success).toBe(true);
    const data = anchorResult.data as any;
    expect(data.contexts.length).toBe(1);
    expect(data.contexts[0].anchors).toBeDefined();
    expect(data.contexts[0].content).toBeUndefined(); // Should not include full content
    expect(data.totalTokens).toBeLessThan(500);
  });
});
