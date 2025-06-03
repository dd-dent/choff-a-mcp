import { describe, it, expect } from 'vitest';
import {
  extractPCHOFFMetadata,
  hasPCHOFFMarkers,
  extractAllPCHOFFMarkers,
  matchesPCHOFFCriteria,
} from '../../src/parser/pchoff-parser.js';
import type { PCHOFFMetadata } from '../../src/storage/types.js';

describe('PCHOFF Parser', () => {
  describe('extractPCHOFFMetadata', () => {
    it('should extract type markers', () => {
      const content =
        '[type:observation] Some observation [type:analysis] and analysis';
      const metadata = extractPCHOFFMetadata(content);

      expect(metadata.types).toEqual(['observation', 'analysis']);
    });

    it('should extract insight markers', () => {
      const content =
        '[insight:direct] Direct insight [insight:emergent] emerging pattern';
      const metadata = extractPCHOFFMetadata(content);

      expect(metadata.insights).toEqual(['direct', 'emergent']);
    });

    it('should extract level markers', () => {
      const content =
        '[level:basic] Basic concept [level:advanced] complex integration';
      const metadata = extractPCHOFFMetadata(content);

      expect(metadata.levels).toEqual(['basic', 'advanced']);
    });

    it('should extract pattern markers with status', () => {
      const content =
        '&pattern:stable@ &pattern:emerging@active@ &pattern:test@disrupted@';
      const metadata = extractPCHOFFMetadata(content);

      expect(metadata.patterns).toEqual([
        'stable',
        'emerging@active',
        'test@disrupted',
      ]);
    });

    it('should extract source markers', () => {
      const content =
        '{source:direct} from experience {source:collective} from group';
      const metadata = extractPCHOFFMetadata(content);

      expect(metadata.sources).toEqual(['direct', 'collective']);
    });

    it('should extract anchor references', () => {
      const content =
        '[anchor:anc_123] [anchor:type:breakthrough] [anchor:conv:conv_456]';
      const metadata = extractPCHOFFMetadata(content);

      expect(metadata.anchorRefs).toEqual([
        'anc_123',
        'type:breakthrough',
        'conv:conv_456',
      ]);
    });

    it('should extract resonance markers', () => {
      const content =
        '&resonance:strong@ &resonance:partial@0.7@ &resonance:weak@';
      const metadata = extractPCHOFFMetadata(content);

      expect(metadata.resonance).toEqual(['strong', 'partial@0.7', 'weak']);
    });

    it('should extract temporal markers', () => {
      const content =
        '[temporal:past] [temporal:present] [temporal:future-potential]';
      const metadata = extractPCHOFFMetadata(content);

      expect(metadata.temporal).toEqual([
        'past',
        'present',
        'future-potential',
      ]);
    });

    it('should handle content with no PCHOFF markers', () => {
      const content = 'Just regular text with no markers';
      const metadata = extractPCHOFFMetadata(content);

      expect(metadata).toEqual({});
    });

    it('should deduplicate repeated markers', () => {
      const content =
        '[type:analysis] [type:analysis] [insight:direct] [insight:direct]';
      const metadata = extractPCHOFFMetadata(content);

      expect(metadata.types).toEqual(['analysis']);
      expect(metadata.insights).toEqual(['direct']);
    });

    it('should handle complex PCHOFF annotation', () => {
      const content = `
        [type:analysis][insight:emergent][level:intermediate]
        &pattern:enhanced_retrieval@stable@
        {source:collective}
        [anchor:anc_1748955497223_1]
        &resonance:strong@
        [temporal:present]
        
        This represents a complex PCHOFF classification with multiple markers.
      `;

      const metadata = extractPCHOFFMetadata(content);

      expect(metadata.types).toEqual(['analysis']);
      expect(metadata.insights).toEqual(['emergent']);
      expect(metadata.levels).toEqual(['intermediate']);
      expect(metadata.patterns).toEqual(['enhanced_retrieval@stable']);
      expect(metadata.sources).toEqual(['collective']);
      expect(metadata.anchorRefs).toEqual(['anc_1748955497223_1']);
      expect(metadata.resonance).toEqual(['strong']);
      expect(metadata.temporal).toEqual(['present']);
    });
  });

  describe('hasPCHOFFMarkers', () => {
    it('should return true for content with PCHOFF markers', () => {
      expect(hasPCHOFFMarkers('[type:observation] test')).toBe(true);
      expect(hasPCHOFFMarkers('test [insight:direct]')).toBe(true);
      expect(hasPCHOFFMarkers('&pattern:stable@')).toBe(true);
      expect(hasPCHOFFMarkers('{source:collective}')).toBe(true);
    });

    it('should return false for content without PCHOFF markers', () => {
      expect(hasPCHOFFMarkers('Just regular text')).toBe(false);
      expect(
        hasPCHOFFMarkers('Even with [context:technical] CHOFF markers'),
      ).toBe(false);
      expect(hasPCHOFFMarkers('{state:analytical} not PCHOFF')).toBe(false);
    });
  });

  describe('extractAllPCHOFFMarkers', () => {
    const conversations = [
      {
        content: '[type:observation][insight:direct] First conversation',
        metadata: { pchoff: { types: ['observation'], insights: ['direct'] } },
      },
      {
        content:
          '[type:analysis][insight:emergent][level:basic] Second conversation',
        metadata: undefined,
      },
      {
        content:
          '[type:theory]{source:collective}&pattern:stable@ Third conversation',
        metadata: { pchoff: { types: ['theory'], sources: ['collective'] } },
      },
    ];

    it('should extract all unique markers from multiple conversations', () => {
      const markers = extractAllPCHOFFMarkers(conversations);

      expect(markers.types).toEqual(['analysis', 'observation', 'theory']);
      expect(markers.insights).toEqual(['direct', 'emergent']);
      expect(markers.levels).toEqual(['basic']);
      expect(markers.patterns).toEqual(['stable']);
      expect(markers.sources).toEqual(['collective']);
    });

    it('should use cached metadata when available', () => {
      const markers = extractAllPCHOFFMarkers([conversations[0]]);

      expect(markers.types).toEqual(['observation']);
      expect(markers.insights).toEqual(['direct']);
    });

    it('should extract from content when metadata not available', () => {
      const markers = extractAllPCHOFFMarkers([conversations[1]]);

      expect(markers.types).toEqual(['analysis']);
      expect(markers.insights).toEqual(['emergent']);
      expect(markers.levels).toEqual(['basic']);
    });
  });

  describe('matchesPCHOFFCriteria', () => {
    const metadata: PCHOFFMetadata = {
      types: ['analysis', 'observation'],
      insights: ['emergent', 'practical'],
      levels: ['intermediate'],
      patterns: ['stable@', 'emerging@active'],
      sources: ['collective'],
    };

    it('should match by type', () => {
      expect(matchesPCHOFFCriteria(metadata, { pchoffType: 'analysis' })).toBe(
        true,
      );
      expect(
        matchesPCHOFFCriteria(metadata, { pchoffType: ['analysis', 'theory'] }),
      ).toBe(true);
      expect(matchesPCHOFFCriteria(metadata, { pchoffType: 'theory' })).toBe(
        false,
      );
    });

    it('should match by insight', () => {
      expect(
        matchesPCHOFFCriteria(metadata, { pchoffInsight: 'emergent' }),
      ).toBe(true);
      expect(
        matchesPCHOFFCriteria(metadata, {
          pchoffInsight: ['meta', 'practical'],
        }),
      ).toBe(true);
      expect(matchesPCHOFFCriteria(metadata, { pchoffInsight: 'meta' })).toBe(
        false,
      );
    });

    it('should match by level', () => {
      expect(
        matchesPCHOFFCriteria(metadata, { pchoffLevel: 'intermediate' }),
      ).toBe(true);
      expect(
        matchesPCHOFFCriteria(metadata, {
          pchoffLevel: ['basic', 'intermediate'],
        }),
      ).toBe(true);
      expect(matchesPCHOFFCriteria(metadata, { pchoffLevel: 'advanced' })).toBe(
        false,
      );
    });

    it('should match by pattern', () => {
      expect(
        matchesPCHOFFCriteria(metadata, { pchoffPattern: 'stable@' }),
      ).toBe(true);
      expect(
        matchesPCHOFFCriteria(metadata, { pchoffPattern: 'emerging@active' }),
      ).toBe(true);
      expect(
        matchesPCHOFFCriteria(metadata, { pchoffPattern: 'disrupted@' }),
      ).toBe(false);
    });

    it('should match by source', () => {
      expect(
        matchesPCHOFFCriteria(metadata, { pchoffSource: 'collective' }),
      ).toBe(true);
      expect(
        matchesPCHOFFCriteria(metadata, {
          pchoffSource: ['direct', 'collective'],
        }),
      ).toBe(true);
      expect(matchesPCHOFFCriteria(metadata, { pchoffSource: 'direct' })).toBe(
        false,
      );
    });

    it('should match multiple criteria (AND logic)', () => {
      expect(
        matchesPCHOFFCriteria(metadata, {
          pchoffType: 'analysis',
          pchoffInsight: 'emergent',
        }),
      ).toBe(true);

      expect(
        matchesPCHOFFCriteria(metadata, {
          pchoffType: 'analysis',
          pchoffInsight: 'meta',
        }),
      ).toBe(false);
    });

    it('should handle undefined metadata', () => {
      expect(matchesPCHOFFCriteria(undefined, { pchoffType: 'analysis' })).toBe(
        false,
      );
    });

    it('should match all when no criteria provided', () => {
      expect(matchesPCHOFFCriteria(metadata, {})).toBe(true);
    });

    it('should handle empty metadata arrays', () => {
      const emptyMetadata: PCHOFFMetadata = {
        types: [],
        insights: [],
        levels: [],
      };

      expect(
        matchesPCHOFFCriteria(emptyMetadata, { pchoffType: 'analysis' }),
      ).toBe(false);
      expect(matchesPCHOFFCriteria(emptyMetadata, {})).toBe(true);
    });
  });
});
