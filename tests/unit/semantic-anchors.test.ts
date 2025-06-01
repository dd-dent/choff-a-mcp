import { describe, it, expect } from 'vitest';
import { extractSemanticAnchors } from '../../src/anchors/semantic-anchor-detector.js';
// import { SemanticAnchor } from '../../src/anchors/types.js';

describe('Semantic Anchor Detection', () => {
  describe('Decision Detection', () => {
    it('should detect simple decision statements', () => {
      const content = 'We decided to use PostgreSQL for the database.';
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(1);
      expect(anchors[0].type).toBe('decision');
      expect(anchors[0].confidence).toBeGreaterThan(0.7);
      expect(anchors[0].text).toBe(
        'We decided to use PostgreSQL for the database',
      );
    });

    it('should detect decision with past tense variations', () => {
      const content =
        'The team chose React over Vue for the frontend framework.';
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(1);
      expect(anchors[0].type).toBe('decision');
      expect(anchors[0].text).toBe(
        'The team chose React over Vue for the frontend framework',
      );
    });

    it('should detect decision with rationale', () => {
      const content =
        'We will go with TypeScript because it provides better type safety.';
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(1);
      expect(anchors[0].type).toBe('decision');
      expect(anchors[0].rationale).toBe('it provides better type safety');
    });

    it('should detect multiple decisions in text', () => {
      const content =
        'After discussion, we decided to use PostgreSQL for data storage. We also chose to implement caching with Redis.';
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(2);
      expect(anchors[0].type).toBe('decision');
      expect(anchors[1].type).toBe('decision');
      expect(anchors[0].text).toContain('PostgreSQL');
      expect(anchors[1].text).toContain('Redis');
    });

    it('should detect decisions with CHOFF state markers', () => {
      const content = '{state:decisive} Going with microservices architecture.';
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(1);
      expect(anchors[0].type).toBe('decision');
      expect(anchors[0].confidence).toBeGreaterThan(0.9);
      expect(anchors[0].choffContext).toBe('decisive');
    });
  });

  describe('Blocker Detection', () => {
    it('should detect simple blocker statements', () => {
      const content = 'We are stuck on authentication implementation.';
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(1);
      expect(anchors[0].type).toBe('blocker');
      expect(anchors[0].text).toBe('stuck on authentication implementation');
    });

    it('should detect blockers with various phrases', () => {
      const testCases = [
        { content: 'Cannot proceed until the API is ready.', expected: 1 },
        { content: 'Blocked by missing environment variables.', expected: 1 },
        {
          content: 'Waiting for design approval before continuing.',
          expected: 1,
        },
        {
          content:
            'The main issue preventing progress is the lack of test data.',
          expected: 2,
        }, // Matches both patterns
      ];

      testCases.forEach(({ content, expected }) => {
        const anchors = extractSemanticAnchors(content);
        expect(anchors).toHaveLength(expected);
        anchors.forEach((anchor) => {
          expect(anchor.type).toBe('blocker');
        });
      });
    });

    it('should detect blockers with CHOFF patterns', () => {
      const content =
        '&pattern:development|blocked| Need to resolve dependency conflicts';
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(1);
      expect(anchors[0].type).toBe('blocker');
      expect(anchors[0].confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Breakthrough Detection', () => {
    it('should detect breakthrough moments', () => {
      const content = 'Found the solution: we need to use connection pooling.';
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(1);
      expect(anchors[0].type).toBe('breakthrough');
      expect(anchors[0].text).toBe(
        'Found the solution: we need to use connection pooling',
      );
    });

    it('should detect various breakthrough phrases', () => {
      const testCases = [
        'Solved by implementing a custom middleware.',
        'The fix was to update the dependency version.',
        'Realized that the issue was in the configuration.',
        'Discovered the root cause: memory leak in the event handler.',
      ];

      testCases.forEach((content) => {
        const anchors = extractSemanticAnchors(content);
        expect(anchors).toHaveLength(1);
        expect(anchors[0].type).toBe('breakthrough');
      });
    });

    it('should detect eureka moments with CHOFF', () => {
      const content =
        '{state:eureka} Finally understood the recursion pattern!';
      const anchors = extractSemanticAnchors(content);

      // May detect both from CHOFF state and text pattern
      expect(anchors.length).toBeGreaterThanOrEqual(1);
      expect(anchors[0].type).toBe('breakthrough');
      expect(anchors[0].confidence).toBeGreaterThan(0.95);
    });
  });

  describe('Question Detection', () => {
    it('should detect open-ended questions', () => {
      const content = 'Should we migrate to a microservices architecture?';
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(1);
      expect(anchors[0].type).toBe('question');
      expect(anchors[0].requiresAnswer).toBe(true);
    });

    it('should detect embedded questions', () => {
      const content =
        'The main question is whether to use SQL or NoSQL for this use case.';
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(1);
      expect(anchors[0].type).toBe('question');
      expect(anchors[0].text).toContain('whether to use SQL or NoSQL');
    });

    it('should detect questions with CHOFF markers', () => {
      const content = '{state:questioning} How do we handle concurrent writes?';
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(1);
      expect(anchors[0].type).toBe('question');
      expect(anchors[0].confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('Confidence Scoring', () => {
    it('should assign higher confidence to explicit markers', () => {
      const explicit = '{state:decisive} We will use GraphQL.';
      const implicit = 'I think we should probably use GraphQL.';

      const explicitAnchors = extractSemanticAnchors(explicit);
      const implicitAnchors = extractSemanticAnchors(implicit);

      expect(explicitAnchors[0].confidence).toBeGreaterThan(
        implicitAnchors[0].confidence,
      );
    });

    it('should consider context for confidence', () => {
      const withContext =
        '[context:architecture] We decided on event-driven design.';
      const noContext = 'We decided on event-driven design.';

      const contextAnchors = extractSemanticAnchors(withContext);
      const noContextAnchors = extractSemanticAnchors(noContext);

      expect(contextAnchors[0].confidence).toBeGreaterThan(
        noContextAnchors[0].confidence,
      );
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple anchor types in one text', () => {
      const content = `{state:analytical} We decided to use PostgreSQL. 
                       However, we're blocked by the lack of migration tools.
                       Should we build our own or use an existing solution?`;

      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(3);
      expect(anchors.map((a) => a.type).sort()).toEqual([
        'blocker',
        'decision',
        'question',
      ]);
    });

    it('should extract relationships between anchors', () => {
      const content = `We decided to implement caching. → This solved our performance issues.`;

      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(2);
      expect(anchors[0].type).toBe('decision');
      expect(anchors[1].type).toBe('breakthrough');
      expect(anchors[1].relatedTo).toContain(anchors[0].id);
    });

    it('should handle conversational context', () => {
      const content = `User: What database should we use?
                       Assistant: {state:decisive} Based on your requirements, PostgreSQL would be ideal.
                       User: Great, let's go with that.`;

      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(2);
      expect(anchors[0].type).toBe('question');
      expect(anchors[1].type).toBe('decision');
      expect(anchors[1].answersQuestion).toBeDefined();
      expect(anchors[1].answersQuestion).toBe(anchors[0].id);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const anchors = extractSemanticAnchors('');
      expect(anchors).toHaveLength(0);
    });

    it('should handle content with no anchors', () => {
      const content = 'This is just a regular update about progress.';
      const anchors = extractSemanticAnchors(content);
      expect(anchors).toHaveLength(0);
    });

    it('should handle malformed CHOFF', () => {
      const content = '{state:decisive We decided to use React.'; // Missing closing brace
      const anchors = extractSemanticAnchors(content);

      expect(anchors).toHaveLength(1);
      expect(anchors[0].type).toBe('decision');
      expect(anchors[0].confidence).toBeLessThan(0.9); // Lower confidence due to malformed CHOFF
    });
  });
});
