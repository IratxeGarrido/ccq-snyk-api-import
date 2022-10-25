export interface SnykOrgData {
  name: string;
  parentOrganization?: {
    name: string,
  };
}

export interface GithubRepoData {
  fork: boolean;
  branch?: string;
  owner?: string;
  name: string;
  topics?: string[];
}

// Can be used for Organizations OR Teams!
export interface GithubOrgData {
  name: string;
  id: number;
  url: string;
  parentOrganization?: {
    name: string,
    id: number;
  };
}
