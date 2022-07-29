import * as pMap from 'p-map';
import {
  bitbucketCloudWorkspaceIsEmpty,
  bitbucketServerProjectIsEmpty,
  githubEnterpriseOrganizations,
  githubOrganizationIsEmpty,
  githubOrganizations,
  gitlabGroupIsEmpty,
  listBitbucketCloudWorkspaces,
  listBitbucketServerProjects,
  listGitlabGroups,
  SnykOrgData,
} from '../lib';
import { CreateOrgData, SupportedIntegrationTypesImportOrgData } from '../lib/types';
import { writeFile } from '../write-file';

const sourceGenerators = {
  [SupportedIntegrationTypesImportOrgData.GITLAB]: listGitlabGroups,
  [SupportedIntegrationTypesImportOrgData.GITHUB]: githubOrganizations,
  [SupportedIntegrationTypesImportOrgData.GHE]: githubEnterpriseOrganizations,
  [SupportedIntegrationTypesImportOrgData.BITBUCKET_SERVER]: listBitbucketServerProjects,
  [SupportedIntegrationTypesImportOrgData.BITBUCKET_CLOUD]: listBitbucketCloudWorkspaces,
};

const sourceNotEmpty = {
  [SupportedIntegrationTypesImportOrgData.GITHUB]: githubOrganizationIsEmpty,
  [SupportedIntegrationTypesImportOrgData.GHE]: githubOrganizationIsEmpty,
  [SupportedIntegrationTypesImportOrgData.GITLAB]: gitlabGroupIsEmpty,
  [SupportedIntegrationTypesImportOrgData.BITBUCKET_SERVER]: bitbucketServerProjectIsEmpty,
  [SupportedIntegrationTypesImportOrgData.BITBUCKET_CLOUD]: bitbucketCloudWorkspaceIsEmpty,
};

export const entityName: {
  [source in SupportedIntegrationTypesImportOrgData]: string;
} = {
  github: 'organization',
  'github-enterprise': 'organization',
  gitlab: 'group',
  'bitbucket-server': 'project',
  'bitbucket-cloud': 'workspace',
};

const exportFileName: {
  [source in SupportedIntegrationTypesImportOrgData]: string;
} = {
  github: 'github-com',
  'github-enterprise': 'github-enterprise',
  gitlab: 'gitlab',
  'bitbucket-server': 'bitbucket-server',
  'bitbucket-cloud': 'bitbucket-cloud',
};

export async function generateOrgImportDataFile(
  source: SupportedIntegrationTypesImportOrgData,
  groupId: string,
  sourceOrgId?: string,
  sourceUrl?: string,
  fromTeams = false,
  skipEmptyOrgs = false,
): Promise<{
  orgs: CreateOrgData[];
  fileName: string;
  skippedEmptyOrgs: SnykOrgData[];
}> {
  const orgData: CreateOrgData[] = [];
  const skippedEmptyOrgs: SnykOrgData[] = [];
  const topLevelEntities: SnykOrgData[] = await sourceGenerators[source]({ sourceUrl, fromTeams });

  await pMap(
    topLevelEntities,
    async (org) => {
      try {
        if (skipEmptyOrgs) {
          const isEmpty = await sourceNotEmpty[source](org.name, sourceUrl);
          if (isEmpty) {
            skippedEmptyOrgs.push(org);
            throw new Error(`Skipping empty ${entityName[source]} ${org.name}`);
          }
        }
        const data: CreateOrgData = {
          name: org.name,
          groupId,
          parentOrganization: org.parentOrganization?.name,
        };
        if (sourceOrgId) {
          data.sourceOrgId = sourceOrgId;
        }
        orgData.push(data);
      } catch (e) {
        console.warn(e.message);
      }
    },
    { concurrency: 10 },
  );

  const fileName = `group-${groupId}-${exportFileName[source]}-orgs.json`;
  await writeFile(fileName, ({
    orgs: orgData,
  } as unknown) as JSON);
  return { orgs: orgData, fileName, skippedEmptyOrgs };
}
