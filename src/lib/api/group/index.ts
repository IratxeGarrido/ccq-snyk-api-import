import 'source-map-support/register';
import * as debugLib from 'debug';
import * as qs from 'querystring';
import { getApiToken } from '../../get-api-token';
import { getSnykHost } from '../../get-snyk-host';
import { requestsManager } from 'snyk-request-manager';
import { Org } from '../../types';

const debug = debugLib('snyk:api-group');

export interface CreatedOrgResponse {
  id: string;
  name: string;
  created: string;
}

export async function createOrg(
  requestManager: requestsManager,
  groupId: string,
  name: string,
  sourceOrgId?: string,
): Promise<CreatedOrgResponse> {
  getApiToken();
  getSnykHost();
  debug(`Creating a new org: "${name}"`);

  if (!groupId || !name) {
    throw new Error(
      `Missing required parameters. Please ensure you have set: groupId, name.
      \nFor more information see: https://snyk.docs.apiary.io/#reference/0/organizations-in-groups/create-a-new-organization-in-the-group`,
    );
  }
  const body: {
    name: string;
    groupId: string;
    sourceOrgId?: string;
  } = {
    name,
    groupId,
    sourceOrgId,
  };
  const res = await requestManager.request({
    verb: 'post',
    url: `/org`,
    body: JSON.stringify(body),
  });
  const statusCode = res.statusCode || res.status;
  if (!statusCode || statusCode !== 201) {
    throw new Error(
      'Expected a 201 response, instead received: ' + JSON.stringify({ data: res.data, status: statusCode }),
    );
  }
  return res.data;
}

export interface ListOrgsResponse {
  id: string;
  name: string;
  url: string;
  orgs: Omit<Org, 'group'>[];
}

export async function listOrgs(
  requestManager: requestsManager,
  groupId: string,
  params: {
    perPage: number;
    page: number;
  },
): Promise<Org[]> {
  if (!groupId) {
    throw new Error('Missing required param groupId');
  }
  const query = qs.stringify(params);

  const res = await requestManager.request({
    verb: 'get',
    url: `/group/${groupId}/orgs?query=${query}`,
    body: JSON.stringify({}),
  });
  const statusCode = res.statusCode || res.status;
  if (!statusCode || statusCode !== 200) {
    throw new Error(
      'Expected a 200 response, instead received: ' +
      JSON.stringify({ statusCode, data: res.data }),
    );
  }

  const data: ListOrgsResponse = res.data;
  return data.orgs.map((org) => ({
    ...org,
    group: {
      name: res.data.name,
      url: res.data.url,
      id: res.data.id,
    },
  }));
}

export async function listOrgsPerPage(
  requestManager: requestsManager,
  groupId: string,
  pageNumber = 1,
  perPage = 100,
): Promise<{
  orgs: Org[];
  hasNextPage: boolean;
}> {
  const data: Org[] = [];
  const params = {
    perPage,
    page: pageNumber,
  };
  const orgs = await listOrgs(requestManager, groupId, params);

  let hasNextPage;
  if (orgs.length) {
    hasNextPage = true;
    data.push(...orgs);
  } else {
    hasNextPage = false;
  }
  return { orgs: data, hasNextPage };
}

export async function getAllOrgs(
  requestManager: requestsManager,
  groupId: string,
): Promise<Org[]> {
  const orgData: Org[] = [];
  let currentPage = 0;
  let hasMorePages = true;
  while (hasMorePages) {
    currentPage = currentPage + 1;
    debug(`Fetching page: ${currentPage}`);
    const { orgs, hasNextPage } = await listOrgsPerPage(
      requestManager,
      groupId,
      currentPage,
    );
    hasMorePages = hasNextPage;
    orgData.push(...orgs);
  }
  return orgData;
}
