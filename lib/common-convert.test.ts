import commonConvert from './common-convert';

describe('commonConvert', (): void => {
  describe('dateTime', (): void => {
    it('works with string', (): void => {
      const d = new Date();
      expect(commonConvert.dateTime(d.toISOString())).toEqual(d);
    });
    it('works with undefined', (): void => {
      expect(commonConvert.dateTime(undefined)).toEqual(undefined);
    });
  });

  describe('requiredDateTime', (): void => {
    it('works with string', (): void => {
      const d = new Date();
      expect(commonConvert.requiredDateTime(d.toISOString())).toEqual(d);
    });
    it('works with undefined', (): void => {
      expect(() => commonConvert.requiredDateTime(undefined)).toThrowError();
    });
  });
});
