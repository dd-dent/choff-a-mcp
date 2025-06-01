#!/usr/bin/env node
/**
 * Example script demonstrating how to use the CHOFF-A-MCP tools
 * This shows how the MCP tools integrate storage and semantic anchor detection
 */

import {
  createSaveCheckpointTool,
  createLoadContextTool,
  createGetAnchorsTool,
  configureStorage,
} from '../src/tools.js';
import * as path from 'path';

interface SaveResultData {
  checkpointId: string;
  anchorsExtracted: number;
  semanticAnchors?: unknown[];
}

// interface LoadResultData {
//   entriesFound: number;
//   entriesReturned: number;
//   contexts: Array<{
//     id: string;
//     summary: string;
//     tags?: string[];
//     choffStats: {
//       totalMarkers: number;
//     };
//   }>;
// }

// interface AnchorResultData {
//   total: number;
//   conversationsScanned: number;
//   anchors: Array<{
//     type: string;
//     text: string;
//     confidence: number;
//     extractionMethod: string;
//     requiresAnswer?: boolean;
//   }>;
// }

async function main(): Promise<void> {
  // Configure storage to use a local file
  const storagePath = path.join(process.cwd(), 'example-conversations.json');
  configureStorage({ storagePath });

  console.log('🚀 CHOFF-A-MCP Tools Example\n');

  // Create tool instances
  const saveCheckpoint = createSaveCheckpointTool();
  const loadContext = createLoadContextTool();
  const getAnchors = createGetAnchorsTool();

  // Example 1: Save a conversation with CHOFF annotations
  console.log('📝 Saving conversation checkpoint...');
  const conversation1 = `{state:analytical}[context:system-design]
We're designing a new authentication system for our application.

{state:decisive} After careful consideration, we've decided to use JWT tokens 
for stateless authentication. This will allow us to scale horizontally.

{state:blocked} However, we're stuck on the token refresh strategy. 
Should we use sliding sessions or fixed expiration with refresh tokens?

&pattern:question|security| What are the security implications of each approach?

→ {state:curious} Need to research OWASP recommendations for JWT best practices.`;

  const saveResult1 = await saveCheckpoint.handler({
    content: conversation1,
    extractAnchors: true,
    generateSummary: true,
  });

  if (saveResult1.success) {
    const data = saveResult1.data as SaveResultData;
    console.log('✅ Saved conversation:', data.checkpointId);
    console.log('   Extracted anchors:', data.anchorsExtracted);
    console.log('   Semantic anchors:', data.semanticAnchors);
  }

  // Example 2: Save another conversation
  console.log('\n📝 Saving another conversation...');
  const conversation2 = `{state:focused}[context:development]
Working on implementing the authentication system.

{state:eureka} Found a great solution! We can use short-lived access tokens (15 min)
with long-lived refresh tokens (7 days) stored in httpOnly cookies.

This addresses our security concerns while maintaining good UX.

&pattern:decision|final| Going with the refresh token approach for better security.`;

  const saveResult2 = await saveCheckpoint.handler({
    content: conversation2,
    extractAnchors: true,
  });

  if (saveResult2.success) {
    console.log(
      '✅ Saved conversation:',
      (saveResult2.data as any).checkpointId,
    );
  }

  // Example 3: Load context with search
  console.log('\n🔍 Loading context about authentication...');
  const loadResult = await loadContext.handler({
    query: 'authentication token',
    maxTokens: 1000,
  });

  if (loadResult.success) {
    const data = loadResult.data as any;
    console.log(
      `✅ Found ${data.entriesFound} conversations, returned ${data.entriesReturned}`,
    );
    data.contexts.forEach((ctx: any, i: number) => {
      console.log(`\n   Context ${i + 1}:`);
      console.log(`   - ID: ${ctx.id}`);
      console.log(`   - Summary: ${ctx.summary}`);
      console.log(`   - Tags: ${ctx.tags?.join(', ')}`);
      console.log(`   - CHOFF markers: ${ctx.choffStats.totalMarkers}`);
    });
  }

  // Example 4: Get all anchors from stored conversations
  console.log('\n🎯 Extracting all anchors from storage...');
  const anchorResult = await getAnchors.handler({});

  if (anchorResult.success) {
    const data = anchorResult.data as any;
    console.log(
      `✅ Found ${data.total} anchors across ${data.conversationsScanned} conversations`,
    );

    // Group by type
    const byType: Record<string, any[]> = {};
    data.anchors.forEach((anchor: any) => {
      if (!byType[anchor.type]) byType[anchor.type] = [];
      byType[anchor.type].push(anchor);
    });

    Object.entries(byType).forEach(([type, anchors]) => {
      console.log(`\n   ${type.toUpperCase()}S (${anchors.length}):`);
      anchors.slice(0, 2).forEach((anchor: any) => {
        console.log(`   - "${anchor.text.substring(0, 60)}..."`);
        console.log(
          `     Confidence: ${anchor.confidence.toFixed(2)}, Method: ${anchor.extractionMethod}`,
        );
      });
    });
  }

  // Example 5: Get unresolved questions
  console.log('\n❓ Finding unresolved questions...');
  const questionResult = await getAnchors.handler({
    type: 'question',
    resolved: false,
  });

  if (questionResult.success) {
    const data = questionResult.data as any;
    const unresolvedQuestions = data.anchors.filter(
      (a: any) => a.requiresAnswer,
    );
    console.log(`✅ Found ${unresolvedQuestions.length} unresolved questions`);
    unresolvedQuestions.forEach((q: any) => {
      console.log(`   - "${q.text}"`);
    });
  }

  // Example 6: Extract anchors from new content without saving
  console.log('\n🔬 Extracting anchors from content directly...');
  const testContent = `{state:planning}
We need to decide on the database architecture.
{state:decisive} After benchmarking, PostgreSQL is the clear winner for our use case.
{state:blocked} But we're waiting for the DevOps team to provision the servers.
{state:curious} Should we consider a managed database service instead?`;

  const directAnchorResult = await getAnchors.handler({
    content: testContent,
  });

  if (directAnchorResult.success) {
    const data = directAnchorResult.data as any;
    console.log(`✅ Extracted ${data.total} anchors from provided content`);
    data.anchors.forEach((anchor: any) => {
      console.log(
        `   - [${anchor.type}] "${anchor.text}" (confidence: ${anchor.confidence.toFixed(2)})`,
      );
    });
  }

  console.log(
    '\n✨ Example complete! Check example-conversations.json for stored data.',
  );
}

// Run the example
main().catch(console.error);
