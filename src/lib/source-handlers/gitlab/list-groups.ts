import * as debugLib from 'debug';
import { Gitlab } from '@gitbeaker/node';
import * as types from '@gitbeaker/core';

import { getToken } from './get-token';
import { getBaseUrl } from './get-base-url';
import { GitlabGroupData } from './types';
import { SourceGeneratorOptions } from '../../types';

const debug = debugLib('snyk:github');

async function fetchOrgsForPage(
  client: types.Gitlab,
  pageNumber = 1,
): Promise<{
  orgs: GitlabGroupData[];
  hasNextPage: boolean;
}> {
  const orgsData: GitlabGroupData[] = [];
  const params = {
    perPage: 100,
    page: pageNumber,
  };
  let hasNextPage;

  const orgs = await client.Groups.all(params);
  if (orgs.length) {
    hasNextPage = true;

    orgsData.push(
      ...orgs.map((org) => ({
        name: org.full_path,
        id: org.id,
        url: org.web_url,
      })),
    );
  } else {
    hasNextPage = false;
  }
  return {
    orgs: orgsData,
    hasNextPage,
  };
}

async function fetchAllOrgs(
  client: types.Gitlab,
  page = 0,
): Promise<GitlabGroupData[]> {
  const orgsData: GitlabGroupData[] = [];
  let currentPage = page;
  let hasMorePages = true;
  while (hasMorePages) {
    currentPage = currentPage + 1;
    debug(`Fetching page ${currentPage}`);
    const { orgs, hasNextPage } = await fetchOrgsForPage(client, currentPage);
    orgsData.push(...orgs);
    hasMorePages = hasNextPage;
  }
  return orgsData;
}

export async function listGitlabGroups({ sourceUrl: host }: SourceGeneratorOptions): Promise<GitlabGroupData[]> {
  const token = getToken();
  const baseUrl = getBaseUrl(host);
  const client = new Gitlab({ host: baseUrl, token });
  debug(`Fetching all Gitlab groups data from ${baseUrl}`);
  return await fetchAllOrgs(client);
}
