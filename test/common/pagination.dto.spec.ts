import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ChangePaginationQueryDto,
  PaginationQueryDto,
} from '../../src/common/pagination/pagination.dto';

describe('pagination DTO conventions', () => {
  it('defaults to page 1 / 20 and coerces strings', async () => {
    const dto = plainToInstance(PaginationQueryDto, { page: '2', pageSize: '30' });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ page: 2, pageSize: 30 });
  });

  it('rejects pageSize above 100 and unknown fields are stripped by the pipe', async () => {
    const dto = plainToInstance(PaginationQueryDto, { pageSize: 101 });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('pageSize');
  });

  it('uses 50 as the default for comparison changes', () => {
    expect(plainToInstance(ChangePaginationQueryDto, {}).pageSize).toBe(50);
  });
});
