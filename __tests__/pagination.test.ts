import { jest } from "@jest/globals";
import type { AxiosInstance } from "axios";
import { BitbucketPaginator, BITBUCKET_MAX_PAGELEN } from "../src/pagination.js";

const createMockAxios = () => {
  return {
    get: jest.fn(),
  } as unknown as AxiosInstance & { get: jest.Mock };
};

const createMockLogger = () => ({
  debug: jest.fn(),
}) as any;

describe("BitbucketPaginator", () => {
  it("respects pagelen and page arguments", async () => {
    const axios = createMockAxios();
    const logger = createMockLogger();
    const paginator = new BitbucketPaginator(axios, logger);

    (axios.get as any).mockResolvedValue({
      data: { values: [{ id: 1 }], page: 1, pagelen: 1 },
    });

    const result = await paginator.fetchValues("/test", {
      pagelen: 1,
      page: 1,
      description: "unit",
    });

    expect(axios.get).toHaveBeenCalledWith("/test", {
      params: { pagelen: 1, page: 1 },
    });
    expect(result.values).toHaveLength(1);
    expect(result.page).toBe(1);
  });

  it("caps pagelen to Bitbucket maximum", async () => {
    const axios = createMockAxios();
    const logger = createMockLogger();
    const paginator = new BitbucketPaginator(axios, logger);

    (axios.get as any).mockResolvedValue({
      data: { values: [], pagelen: BITBUCKET_MAX_PAGELEN },
    });

    await paginator.fetchValues("/test", { pagelen: BITBUCKET_MAX_PAGELEN + 25 });

    expect(axios.get).toHaveBeenCalledWith("/test", {
      params: { pagelen: BITBUCKET_MAX_PAGELEN },
    });
  });

  it("follows next links when all=true", async () => {
    const axios = createMockAxios();
    const logger = createMockLogger();
    const paginator = new BitbucketPaginator(axios, logger);

    (axios.get as any)
      .mockResolvedValueOnce({
        data: {
          values: [{ id: 1 }],
          next: "https://api.bitbucket.org/2.0/test?page=2",
        },
      })
      .mockResolvedValueOnce({ data: { values: [{ id: 2 }] } });

    const result = await paginator.fetchValues<{ id: number }>("/test", {
      all: true,
    });

    expect(axios.get).toHaveBeenNthCalledWith(1, "/test", {
      params: { pagelen: 10 },
    });
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      "https://api.bitbucket.org/2.0/test?page=2",
      undefined
    );
    expect(result.values.map((item) => item.id)).toEqual([1, 2]);
    expect(result.fetchedPages).toBe(2);
    expect(result.totalFetched).toBe(2);
  });
});
