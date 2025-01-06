export interface NexusNode {
  id: string;
  type: string;
  insights: string[];
  metadata?: {
    created: number;
    lastModified: number;
    importance: number;
    confidence: number;
    source?: string;
  };
}

export interface NexusLink {
  id: string;
  source: string;
  target: string;
  type: string;
  metadata?: {
    created: number;
    lastModified: number;
    strength: number;
    confidence: number;
  };
}

export interface CreateEntitiesArgs {
  entities: {
    name: string;
    nodeType: string;
    insights?: string[];
  }[];
}

export interface CreateRelationsArgs {
  relations: {
    from: string;
    to: string;
    linkType: string;
  }[];
}

export interface AddObservationsArgs {
  observations: {
    entityName: string;
    contents: string[];
  }[];
}

export interface DeleteEntitiesArgs {
  entityNames: string[];
}

export interface DeleteObservationsArgs {
  deletions: {
    entityName: string;
    observations: string[];
  }[];
}

export interface DeleteRelationsArgs {
  relations: {
    from: string;
    to: string;
    linkType: string;
  }[];
}

export interface SearchNodesArgs {
  query: string;
}
