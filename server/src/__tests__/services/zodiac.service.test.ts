import { describe, it, expect } from 'vitest';
import {
  computeWesternSign,
  computeChineseSign,
  computeAgentArchetype,
  computeWesternCompatibility,
  computeChineseCompatibility,
  computeOverallCompatibility,
  getPersonalityTraits,
} from '../../services/zodiac.service';

describe('zodiac.service', () => {
  describe('computeWesternSign', () => {
    it('should return aries for March 25', () => {
      expect(computeWesternSign('1990-03-25')).toBe('aries');
    });

    it('should return aries for April 19', () => {
      expect(computeWesternSign('1990-04-19')).toBe('aries');
    });

    it('should return taurus for April 20', () => {
      expect(computeWesternSign('1990-04-20')).toBe('taurus');
    });

    it('should return taurus for May 20', () => {
      expect(computeWesternSign('1990-05-20')).toBe('taurus');
    });

    it('should return gemini for May 21', () => {
      expect(computeWesternSign('1990-05-21')).toBe('gemini');
    });

    it('should return gemini for June 20', () => {
      expect(computeWesternSign('1990-06-20')).toBe('gemini');
    });

    it('should return cancer for June 21', () => {
      expect(computeWesternSign('1990-06-21')).toBe('cancer');
    });

    it('should return cancer for July 22', () => {
      expect(computeWesternSign('1990-07-22')).toBe('cancer');
    });

    it('should return leo for July 23', () => {
      expect(computeWesternSign('1990-07-23')).toBe('leo');
    });

    it('should return leo for August 22', () => {
      expect(computeWesternSign('1990-08-22')).toBe('leo');
    });

    it('should return virgo for August 23', () => {
      expect(computeWesternSign('1990-08-23')).toBe('virgo');
    });

    it('should return virgo for September 22', () => {
      expect(computeWesternSign('1990-09-22')).toBe('virgo');
    });

    it('should return libra for September 23', () => {
      expect(computeWesternSign('1990-09-23')).toBe('libra');
    });

    it('should return libra for October 22', () => {
      expect(computeWesternSign('1990-10-22')).toBe('libra');
    });

    it('should return scorpio for October 23', () => {
      expect(computeWesternSign('1990-10-23')).toBe('scorpio');
    });

    it('should return scorpio for November 21', () => {
      expect(computeWesternSign('1990-11-21')).toBe('scorpio');
    });

    it('should return sagittarius for November 22', () => {
      expect(computeWesternSign('1990-11-22')).toBe('sagittarius');
    });

    it('should return sagittarius for December 21', () => {
      expect(computeWesternSign('1990-12-21')).toBe('sagittarius');
    });

    it('should return capricorn for December 22', () => {
      expect(computeWesternSign('1990-12-22')).toBe('capricorn');
    });

    it('should return capricorn for January 1', () => {
      expect(computeWesternSign('1991-01-01')).toBe('capricorn');
    });

    it('should return capricorn for January 19', () => {
      expect(computeWesternSign('1991-01-19')).toBe('capricorn');
    });

    it('should return aquarius for January 20', () => {
      expect(computeWesternSign('1991-01-20')).toBe('aquarius');
    });

    it('should return aquarius for February 18', () => {
      expect(computeWesternSign('1991-02-18')).toBe('aquarius');
    });

    it('should return pisces for February 19', () => {
      expect(computeWesternSign('1991-02-19')).toBe('pisces');
    });

    it('should return pisces for March 20', () => {
      expect(computeWesternSign('1991-03-20')).toBe('pisces');
    });
  });

  describe('computeChineseSign', () => {
    it('should return rat for year 2020', () => {
      expect(computeChineseSign('2020-06-15')).toBe('rat');
    });

    it('should return ox for year 2021', () => {
      expect(computeChineseSign('2021-06-15')).toBe('ox');
    });

    it('should return tiger for year 2022', () => {
      expect(computeChineseSign('2022-06-15')).toBe('tiger');
    });

    it('should return rabbit for year 2023', () => {
      expect(computeChineseSign('2023-06-15')).toBe('rabbit');
    });

    it('should return dragon for year 2024', () => {
      expect(computeChineseSign('2024-06-15')).toBe('dragon');
    });

    it('should return snake for year 2025', () => {
      expect(computeChineseSign('2025-06-15')).toBe('snake');
    });

    it('should return horse for year 2026', () => {
      expect(computeChineseSign('2026-06-15')).toBe('horse');
    });

    it('should return rat for year 1996', () => {
      expect(computeChineseSign('1996-03-01')).toBe('rat');
    });

    it('should return monkey for year 1992', () => {
      expect(computeChineseSign('1992-01-01')).toBe('monkey');
    });

    it('should return dog for year 1994', () => {
      expect(computeChineseSign('1994-07-04')).toBe('dog');
    });

    it('should return pig for year 1995', () => {
      expect(computeChineseSign('1995-12-25')).toBe('pig');
    });

    it('should handle years before the epoch correctly', () => {
      // Year 4 AD is the base year (rat), so year 0 would cycle back
      expect(computeChineseSign('1900-01-01')).toBe('rat');
    });
  });

  describe('computeAgentArchetype', () => {
    it('should return sage for mentor', () => {
      expect(computeAgentArchetype('mentor')).toBe('sage');
    });

    it('should return architect for assistant', () => {
      expect(computeAgentArchetype('assistant')).toBe('architect');
    });

    it('should return empath for companion', () => {
      expect(computeAgentArchetype('companion')).toBe('empath');
    });

    it('should return oracle for advisor', () => {
      expect(computeAgentArchetype('advisor')).toBe('oracle');
    });

    it('should return catalyst for coach', () => {
      expect(computeAgentArchetype('coach')).toBe('catalyst');
    });

    it('should default to sage for unknown agent types', () => {
      expect(computeAgentArchetype('unknown')).toBe('sage');
    });

    it('should default to sage for empty string', () => {
      expect(computeAgentArchetype('')).toBe('sage');
    });
  });

  describe('computeWesternCompatibility', () => {
    it('should return aries-leo compatibility scaled to 0-100', () => {
      expect(computeWesternCompatibility('aries', 'leo')).toBe(90);
    });

    it('should return aries-aries compatibility scaled to 0-100', () => {
      expect(computeWesternCompatibility('aries', 'aries')).toBe(60);
    });

    it('should return cancer-scorpio compatibility as 90', () => {
      expect(computeWesternCompatibility('cancer', 'scorpio')).toBe(90);
    });

    it('should be case-insensitive', () => {
      expect(computeWesternCompatibility('ARIES', 'LEO')).toBe(90);
    });

    it('should return 50 for unknown signs', () => {
      expect(computeWesternCompatibility('unknown', 'leo')).toBe(50);
    });

    it('should return taurus-virgo as 90', () => {
      expect(computeWesternCompatibility('taurus', 'virgo')).toBe(90);
    });
  });

  describe('computeChineseCompatibility', () => {
    it('should return 90 for best matches (rat-dragon)', () => {
      expect(computeChineseCompatibility('rat', 'dragon')).toBe(90);
    });

    it('should return 90 for best matches (rat-monkey)', () => {
      expect(computeChineseCompatibility('rat', 'monkey')).toBe(90);
    });

    it('should return 90 for best matches (rat-ox)', () => {
      expect(computeChineseCompatibility('rat', 'ox')).toBe(90);
    });

    it('should return 70 for same sign', () => {
      expect(computeChineseCompatibility('rat', 'rat')).toBe(70);
    });

    it('should return 50 for neutral matches', () => {
      expect(computeChineseCompatibility('rat', 'horse')).toBe(50);
    });

    it('should be case-insensitive', () => {
      expect(computeChineseCompatibility('RAT', 'DRAGON')).toBe(90);
    });

    it('should return 50 for unknown signs', () => {
      expect(computeChineseCompatibility('unknown', 'dragon')).toBe(50);
    });

    it('should return tiger-horse as 90', () => {
      expect(computeChineseCompatibility('tiger', 'horse')).toBe(90);
    });

    it('should return tiger-dog as 90', () => {
      expect(computeChineseCompatibility('tiger', 'dog')).toBe(90);
    });
  });

  describe('computeOverallCompatibility', () => {
    it('should average western and chinese scores equally when no personality score', () => {
      expect(computeOverallCompatibility(80, 60)).toBe(70);
    });

    it('should weight all three scores when personality score is provided', () => {
      // 80*0.3 + 60*0.3 + 100*0.4 = 24 + 18 + 40 = 82
      expect(computeOverallCompatibility(80, 60, 100)).toBe(82);
    });

    it('should round to nearest integer', () => {
      // 90*0.5 + 50*0.5 = 45 + 25 = 70
      expect(computeOverallCompatibility(90, 50)).toBe(70);
    });

    it('should handle zeros', () => {
      expect(computeOverallCompatibility(0, 0)).toBe(0);
    });

    it('should handle personality score of 0', () => {
      // 80*0.3 + 60*0.3 + 0*0.4 = 24 + 18 + 0 = 42
      expect(computeOverallCompatibility(80, 60, 0)).toBe(42);
    });

    it('should weight correctly with all 100s', () => {
      expect(computeOverallCompatibility(100, 100, 100)).toBe(100);
    });

    it('should handle rounding correctly', () => {
      // 73*0.5 + 51*0.5 = 36.5 + 25.5 = 62
      expect(computeOverallCompatibility(73, 51)).toBe(62);
    });
  });

  describe('getPersonalityTraits', () => {
    it('should return correct traits for aries', () => {
      const traits = getPersonalityTraits('aries');
      expect(traits).toEqual({
        boldness: 90,
        patience: 30,
        empathy: 50,
        creativity: 70,
        leadership: 85,
      });
    });

    it('should return correct traits for pisces', () => {
      const traits = getPersonalityTraits('pisces');
      expect(traits).toEqual({
        boldness: 25,
        patience: 65,
        empathy: 90,
        creativity: 90,
        leadership: 30,
      });
    });

    it('should return correct traits for leo', () => {
      const traits = getPersonalityTraits('leo');
      expect(traits.boldness).toBe(95);
      expect(traits.leadership).toBe(90);
    });

    it('should be case-insensitive', () => {
      const traits = getPersonalityTraits('ARIES');
      expect(traits.boldness).toBe(90);
    });

    it('should default to aries traits for unknown signs', () => {
      const traits = getPersonalityTraits('unknown');
      expect(traits).toEqual(getPersonalityTraits('aries'));
    });

    it('should have exactly 5 trait keys', () => {
      const traits = getPersonalityTraits('cancer');
      expect(Object.keys(traits)).toHaveLength(5);
      expect(Object.keys(traits).sort()).toEqual(
        ['boldness', 'creativity', 'empathy', 'leadership', 'patience']
      );
    });

    it('should return traits for all 12 signs', () => {
      const signs = [
        'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
        'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
      ];
      for (const sign of signs) {
        const traits = getPersonalityTraits(sign);
        expect(Object.keys(traits)).toHaveLength(5);
        for (const val of Object.values(traits)) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(100);
        }
      }
    });
  });
});
