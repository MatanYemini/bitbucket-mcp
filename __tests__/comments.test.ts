import { withoutDeletedThreads } from "../src/comments.js";

describe("withoutDeletedThreads", () => {
  it("keeps live comments untouched", () => {
    const comments = [
      { id: 1, deleted: false },
      { id: 2, parent: { id: 1 } },
    ];

    expect(withoutDeletedThreads(comments)).toEqual(comments);
  });

  it("drops a deleted comment", () => {
    const comments = [
      { id: 1, deleted: false },
      { id: 2, deleted: true },
    ];

    expect(withoutDeletedThreads(comments).map((c) => c.id)).toEqual([1]);
  });

  it("drops replies below a deleted thread root", () => {
    const comments = [
      { id: 1, deleted: true },
      { id: 2, parent: { id: 1 } },
      { id: 3, parent: { id: 2 } },
      { id: 4, deleted: false },
    ];

    expect(withoutDeletedThreads(comments).map((c) => c.id)).toEqual([4]);
  });

  it("keeps a live thread whose reply was deleted", () => {
    const comments = [
      { id: 1, deleted: false },
      { id: 2, parent: { id: 1 }, deleted: true },
      { id: 3, parent: { id: 1 } },
    ];

    expect(withoutDeletedThreads(comments).map((c) => c.id)).toEqual([1, 3]);
  });

  it("keeps a reply whose parent is missing from the page", () => {
    const comments = [{ id: 2, parent: { id: 99 } }];

    expect(withoutDeletedThreads(comments).map((c) => c.id)).toEqual([2]);
  });

  it("does not loop on cyclic ancestry", () => {
    const comments = [
      { id: 1, parent: { id: 2 } },
      { id: 2, parent: { id: 1 } },
    ];

    expect(withoutDeletedThreads(comments).map((c) => c.id)).toEqual([1, 2]);
  });

  it("matches string and number comment ids", () => {
    const comments = [
      { id: 1, deleted: true },
      { id: 2, parent: { id: "1" } },
    ];

    expect(withoutDeletedThreads(comments)).toEqual([]);
  });

  it("returns a non-array input unchanged", () => {
    expect(withoutDeletedThreads(undefined as never)).toBeUndefined();
  });
});
