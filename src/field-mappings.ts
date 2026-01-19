export const DC_TO_CLOUD_REPOSITORY_FIELDS = {
  id: 'uuid',
  name: 'name',
  slug: 'slug',
  'project.key': 'project.key',
  'project.name': 'project.name',
  public: 'is_private',
  'links.clone': 'links.clone',
  'links.self': 'links.self'
} as const;

export const DC_TO_CLOUD_PULL_REQUEST_FIELDS = {
  id: 'id',
  title: 'title',
  description: 'description',
  state: 'state',
  'author.user.displayName': 'author.display_name',
  'author.user.id': 'author.uuid',
  'fromRef.displayId': 'source.branch.name',
  'fromRef.latestCommit': 'source.commit.hash',
  'toRef.displayId': 'destination.branch.name',
  'toRef.latestCommit': 'destination.commit.hash',
  createdDate: 'created_on',
  updatedDate: 'updated_on'
} as const;

export const DC_TO_CLOUD_PAGINATION_FIELDS = {
  start: 'page',
  limit: 'pagelen',
  isLastPage: 'next',
  values: 'values'
} as const;

export const PULL_REQUEST_STATE_MAP: Record<string, string> = {
  OPEN: 'OPEN',
  MERGED: 'MERGED',
  DECLINED: 'DECLINED',
  SUPERSEDED: 'DECLINED'
};
