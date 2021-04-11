import { useCallback, useMemo } from 'react';
import { useSWRInfinite } from 'swr';
import { cleanParams, fetcher } from '../../lib/fetcher';
import { IComment, IGiscussion, IReply } from '../../lib/models/adapter';
import { PaginationParams } from '../../lib/models/common';

export function useDiscussions(id: string, token?: string, pagination: PaginationParams = {}) {
  const urlParams = new URLSearchParams(cleanParams({ id, ...pagination }));

  const headers = useMemo(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return { headers };
  }, [token]);

  const getKey = (pageIndex: number, previousPageData?: IGiscussion) => {
    if (pageIndex === 0) return [`/api/discussions?${urlParams}`, headers];
    if (!previousPageData.pageInfo.hasNextPage) return null;
    const params = new URLSearchParams(
      cleanParams({ id, after: previousPageData.pageInfo.endCursor }),
    );
    return [`/api/discussions?${params}`, headers];
  };

  const { data, size, setSize, error, mutate } = useSWRInfinite<IGiscussion>(getKey, fetcher);

  const addNewComment = useCallback(
    (comment: IComment) => {
      const first = data.slice(0, data.length - 1);
      const [last] = data.slice(-1);
      return mutate([
        ...first,
        { ...last, totalCount: last.totalCount + 1, comments: [...last.comments, comment] },
      ]);
    },
    [data, mutate],
  );

  const addNewReply = useCallback(
    (reply: IReply) =>
      mutate(
        data.map((page) => ({
          ...page,
          totalCount: page.totalCount + 1,
          comments: page.comments.map((comment) =>
            comment.id === reply.replyToId
              ? { ...comment, replies: [...comment.replies, reply] }
              : comment,
          ),
        })),
      ),
    [data, mutate],
  );

  const updateComment = useCallback(
    (newComment: IComment, promise?: Promise<unknown>) =>
      mutate(
        data.map((page) => ({
          ...page,
          comments: page.comments.map((comment) =>
            comment.id === newComment.id ? newComment : comment,
          ),
        })),
        !promise,
      ) && promise?.then(() => mutate()),
    [data, mutate],
  );

  const updateReply = useCallback(
    (newReply: IReply, promise?: Promise<unknown>) =>
      mutate(
        data.map((page) => ({
          ...page,
          comments: page.comments.map((comment) =>
            comment.id === newReply.replyToId
              ? {
                  ...comment,
                  replies: comment.replies.map((reply) =>
                    reply.id === newReply.id ? newReply : reply,
                  ),
                }
              : comment,
          ),
        })),
        !promise,
      ) && promise?.then(() => mutate()),
    [data, mutate],
  );

  return {
    data,
    size,
    setSize,
    isLoading: !error && !data,
    isError: !!error,
    mutators: { addNewComment, addNewReply, updateComment, updateReply },
  };
}
