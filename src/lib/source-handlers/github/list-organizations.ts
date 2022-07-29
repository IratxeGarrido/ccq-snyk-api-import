import { Octokit } from '@octokit/rest';
import * as parseLinkHeader from 'parse-link-header';
import * as debugLib from 'debug';

import { getGithubBaseUrl } from './github-base-url';
import { GithubOrgData, SnykOrgData } from './types';
import { getGithubToken } from './get-github-token';
import { SourceGeneratorOptions } from '../../types';

const debug = debugLib('snyk:github');

async function fetchOrgsForPage(
  octokit: Octokit,
  options: SourceGeneratorOptions,
  pageNumber = 1,
  since = 0,
  isGithubEnterprise = false,
): Promise<{
  orgs: GithubOrgData[];
  hasNextPage: boolean;
  since?: number;
}> {
  const orgsData: GithubOrgData[] = [];
  const params = {
    per_page: 100,
    page: pageNumber,
    since,
  };

  const res = isGithubEnterprise
    ? await octokit.orgs.list(params)
    : await octokit.orgs.listForAuthenticatedUser(params);
  const links = parseLinkHeader(res.headers.link as string) || {};
  const orgs = res && res.data;

  if (orgs.length) {
    if (options.fromTeams) {
      // Iterate through orgs and fetch ALL teams! Might be worth it to add an option to import just one organisation.
      for (const org of orgs) {
        const teamsRes = await octokit.teams.list({ ...params, org: org.login });
        const teams = teamsRes && teamsRes.data;
        if (teams.length) {
          orgsData.push(
            ...teams.map(team => ({
              name: team.slug,
              id: team.id,
              parentOrganization: {
                name: org.login,
                id: org.id,
              },
              url: team.url,
            })));
        }
      }
    } else {
      orgsData.push(
        ...orgs.map((org) => ({
          name: org.login,
          id: org.id,
          url: org.url,
        })),
      );
    }
  }

  return {
    orgs: orgsData,
    hasNextPage: !!links.next,
    since: links.next ? Number(links.next.since) : undefined,
  };
}

async function fetchAllOrgs(
  octokit: Octokit,
  page = 0,
  isGithubEnterprise = false,
  options: SourceGeneratorOptions,
): Promise<GithubOrgData[]> {
  const orgsData: GithubOrgData[] = [];
  let currentPage = page;
  let hasMorePages = true;
  let currentSince = 0;
  while (hasMorePages) {
    currentPage = currentPage + 1;
    debug(`Fetching page ${currentPage}`);
    const { orgs, hasNextPage, since } = await fetchOrgsForPage(
      octokit,
      options,
      currentPage,
      currentSince,
      isGithubEnterprise,
    );
    orgsData.push(...orgs);
    hasMorePages = hasNextPage;
    if (since) {
      currentSince = since;
    }
  }
  return orgsData;
}

export async function listGithubOrgs(options: SourceGeneratorOptions): Promise<GithubOrgData[]> {
  const { sourceUrl: host, ...restOpts } = options;
  const githubToken = getGithubToken();
  const baseUrl = getGithubBaseUrl(host);
  const octokit: Octokit = new Octokit({ baseUrl, auth: githubToken });
  debug('Fetching all Github organizations data');
  return await fetchAllOrgs(octokit, undefined, !!host, restOpts);
}

export async function githubEnterpriseOrganizations(options: SourceGeneratorOptions): Promise<SnykOrgData[]> {
  if (!options.sourceUrl) {
    console.warn(
      'No `sourceUrl` provided for Github Enterprise source, defaulting to https://api.github.com',
    );
  }
  return await listGithubOrgs(options);
}

export async function githubOrganizations(options: SourceGeneratorOptions): Promise<SnykOrgData[]> {
  return await listGithubOrgs(options);
}
