import { describe, it, expect, beforeEach } from 'vitest';
import { CHOFFParser } from '../src/parser';

describe('CHOFFParser', () => {
  let parser: CHOFFParser;

  beforeEach(() => {
    parser = new CHOFFParser();
  });

  describe('State Extraction', () => {
    it('should parse simple state markers', () => {
      const text = 'I am {state:analytical} about this problem';
      const doc = parser.parse(text);

      expect(doc.states).toHaveLength(1);
      expect(doc.states[0]).toEqual({
        type: 'simple',
        value: 'analytical',
        position: { start: 5, end: 23 },
        raw: '{state:analytical}',
      });
    });

    it('should parse intensity state markers', () => {
      const text = '{state:intensity|analytical[0.8]|creative[0.5]|}';
      const doc = parser.parse(text);

      expect(doc.states).toHaveLength(1);
      expect(doc.states[0]).toEqual({
        type: 'intensity',
        values: [
          { state: 'analytical', intensity: 0.8 },
          { state: 'creative', intensity: 0.5 },
        ],
        position: { start: 0, end: 48 },
        raw: text,
      });
    });

    it('should parse weighted state markers', () => {
      const text = '{state:weighted|focused[0.9]|distracted[0.1]|}';
      const doc = parser.parse(text);

      expect(doc.states).toHaveLength(1);
      expect(doc.states[0]).toEqual({
        type: 'weighted',
        values: [
          { state: 'focused', weight: 0.9 },
          { state: 'distracted', weight: 0.1 },
        ],
        position: { start: 0, end: 46 },
        raw: text,
      });
    });

    it('should parse shorthand weighted states', () => {
      const text = '{state:weighted:reflective|analytical[0.5]|}';
      const doc = parser.parse(text);

      expect(doc.states).toHaveLength(1);
      expect(doc.states[0]).toEqual({
        type: 'weighted',
        values: [
          { state: 'reflective', weight: 0.5 },
          { state: 'analytical', weight: 0.5 },
        ],
        position: { start: 0, end: 44 },
        raw: text,
      });
    });

    it('should parse random distribution states', () => {
      const text = '{state:random!optimistic[0.5]!skeptical[0.5]!}';
      const doc = parser.parse(text);

      expect(doc.states).toHaveLength(1);
      expect(doc.states[0]).toEqual({
        type: 'random',
        values: [
          { state: 'optimistic', weight: 0.5 },
          { state: 'skeptical', weight: 0.5 },
        ],
        position: { start: 0, end: 46 },
        raw: text,
      });
    });

    it('should handle malformed state markers gracefully', () => {
      const text = '{state:} {state: invalid } {state:analytical';
      const doc = parser.parse(text);

      expect(doc.states).toHaveLength(0);
      expect(doc.errors).toHaveLength(3);
    });
  });

  describe('Context Extraction', () => {
    it('should parse context markers', () => {
      const text = 'Working on [context:technical] problems today';
      const doc = parser.parse(text);

      expect(doc.contexts).toHaveLength(1);
      expect(doc.contexts[0]).toEqual({
        value: 'technical',
        position: { start: 11, end: 30 },
        raw: '[context:technical]',
      });
    });

    it('should parse multiple contexts', () => {
      const text = '[context:meta] discussing [context:implementation]';
      const doc = parser.parse(text);

      expect(doc.contexts).toHaveLength(2);
      expect(doc.contexts[0].value).toBe('meta');
      expect(doc.contexts[1].value).toBe('implementation');
    });
  });

  describe('Pattern Recognition', () => {
    it('should parse dynamic patterns', () => {
      const text = 'Observing &pattern:resonance|active|';
      const doc = parser.parse(text);

      expect(doc.patterns).toHaveLength(1);
      expect(doc.patterns[0]).toEqual({
        type: 'pattern',
        category: 'resonance',
        flow: 'active',
        position: { start: 10, end: 36 },
        raw: '&pattern:resonance|active|',
      });
    });

    it('should parse static status markers', () => {
      const text = 'Currently &status:processing|';
      const doc = parser.parse(text);

      expect(doc.patterns).toHaveLength(1);
      expect(doc.patterns[0]).toEqual({
        type: 'status',
        category: 'processing',
        flow: null,
        position: { start: 10, end: 29 },
        raw: '&status:processing|',
      });
    });
  });

  describe('Directional Operators', () => {
    it('should parse all directional operators', () => {
      const text =
        '→ forward ← backward ↔ bidirectional ↠ transition ⇄ cascade';
      const doc = parser.parse(text);

      expect(doc.directionals).toHaveLength(5);
      expect(doc.directionals.map((d) => d.type)).toEqual([
        'forward',
        'backward',
        'bidirectional',
        'transition',
        'cascade',
      ]);
    });

    it('should parse enhanced directional operators', () => {
      const text =
        '⇉ strong forward ⇇ strong back ⇋ enhanced ↔↔ strong bilateral';
      const doc = parser.parse(text);

      expect(doc.directionals).toHaveLength(4);
      expect(doc.directionals[0].enhanced).toBe(true);
    });
  });

  describe('Branch Markers', () => {
    it('should parse branch initiation', () => {
      const text = '{branch:1|Exploration}';
      const doc = parser.parse(text);

      expect(doc.branches).toHaveLength(1);
      expect(doc.branches[0]).toEqual({
        type: 'init',
        id: '1',
        label: 'Exploration',
        position: { start: 0, end: 22 },
        raw: text,
      });
    });

    it('should parse branch without label', () => {
      const text = '{branch:altA}';
      const doc = parser.parse(text);

      expect(doc.branches).toHaveLength(1);
      expect((doc.branches[0] as any).label).toBeUndefined();
    });

    it('should parse branch merge', () => {
      const text = '→merge{branch:1}';
      const doc = parser.parse(text);

      expect(doc.branches).toHaveLength(1);
      expect(doc.branches[0]).toEqual({
        type: 'merge',
        id: '1',
        position: { start: 0, end: 16 },
        raw: text,
      });
    });

    it('should parse branch termination', () => {
      const text = '{branch_end:1}';
      const doc = parser.parse(text);

      expect(doc.branches).toHaveLength(1);
      expect(doc.branches[0].type).toBe('end');
    });
  });

  describe('Social Layer', () => {
    it('should parse social layer markers', () => {
      const text = '{social:formal}[mask:professional]';
      const doc = parser.parse(text);

      expect(doc.socialLayers).toHaveLength(1);
      expect(doc.socialLayers[0]).toEqual({
        level: 'formal',
        mask: 'professional',
        position: { start: 0, end: 34 },
        raw: text,
      });
    });
  });

  describe('Complex Documents', () => {
    it('should parse mixed CHOFF elements', () => {
      const text = `{state:analytical} [context:problem_solving]
→ exploring patterns with {state:intensity|curious[0.8]|focused[0.9]|}
&pattern:discovery|active|`;

      const doc = parser.parse(text);

      expect(doc.states).toHaveLength(2);
      expect(doc.contexts).toHaveLength(1);
      expect(doc.directionals).toHaveLength(1);
      expect(doc.patterns).toHaveLength(1);
    });

    it('should handle nested structures', () => {
      const text = '{state:weighted|analytical[0.5]|{branch:1|nested}[0.5]|}';
      const doc = parser.parse(text);

      // Should parse the outer state but flag the nested branch as an error
      expect(doc.states).toHaveLength(1);
      expect(doc.errors).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    it('should parse 10KB of CHOFF text in under 50ms', () => {
      // Generate 10KB of CHOFF-annotated text
      const chunks = [];
      for (let i = 0; i < 100; i++) {
        chunks.push(`{state:analytical} exploring [context:iteration${i}]
→ developing {state:weighted|focused[0.8]|creative[0.2]|}
&pattern:thinking|active| observations...
`);
      }
      const largeText = chunks.join('\n');

      const startTime = performance.now();
      const doc = parser.parse(largeText);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50);
      expect(doc.states.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should collect parsing errors without throwing', () => {
      const text = '{state:} [context:] {invalid} → nowhere';
      const doc = parser.parse(text);

      expect(doc.errors).toHaveLength(3);
      expect(doc.errors[0].message).toContain('state');
      expect(doc.directionals).toHaveLength(1); // Should still parse valid parts
    });

    it('should validate weighted state sums', () => {
      const text = '{state:weighted|a[0.6]|b[0.6]|}'; // Sum > 1
      const doc = parser.parse(text);

      expect(doc.states).toHaveLength(1);
      expect(doc.errors).toHaveLength(1);
      expect(doc.errors[0].message).toContain('sum to 1.0');
    });
  });
});
