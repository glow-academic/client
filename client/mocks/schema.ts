// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 93,
    "userId": 46,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 81,
    "idToken": "idToken_1",
    "sessionState": "sessionState_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 38,
    "userId": 90,
    "expires": "2025-08-08T13:05:45.563Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "nqdf2s41-kkkp-cmgy-t2pv-autmnba5rg6",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1",
    "active": true,
    "tags": [
      "tags_1"
    ]
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 74,
    "emailVerified": "2025-08-08T13:05:45.563Z",
    "image": "image_1"
  },
  {
    "id": 68,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "image": "image_2"
  },
  {
    "id": 100,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-08-08T13:05:45.563Z",
    "image": "image_3"
  },
  {
    "id": 85,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-08-08T13:05:45.563Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "1849lkqs-yu3j-qax0-x85l-3cauaqa0suu",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "lastLogin": "2025-08-08T13:05:45.563Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-08-08T13:05:45.563Z",
    "userId": 74
  },
  {
    "id": "716o9ak2-5hea-32f6-orek-rhgytgsj6p",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "userId": 68,
    "lastLogin": "2025-08-08T13:05:45.563Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-08-08T13:05:45.563Z"
  },
  {
    "id": "9vftlid5-cipy-un59-he7q-y8ul5l8l6d",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "lastLogin": "2025-08-08T13:05:45.563Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-08-08T13:05:45.563Z",
    "userId": 100
  },
  {
    "id": "41kg6nk1-3eb9-xtb2-3rcc-zk27pwhjie",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "userId": 85,
    "lastLogin": "2025-08-08T13:05:45.563Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-08-08T13:05:45.563Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "sdrsjmv7-meef-2iql-nxqv-bkuspmnzxwv",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "a67f687h-lhqz-u43h-tp61-t13ntam53yc",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "ss9wx0ov-s0ub-ac55-k9s6-qk8a0zs64p",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 88,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "qs63xj4d-6vpt-ib4z-yvya-fdpo72hijjb",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 45,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "5vyc9ede-mdpu-makn-edzj-fncbkl3ge4m",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 24,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 46,
    "level": "level_1",
    "context": {},
    "createdAt": "2025-08-08T13:05:45.563Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "ip6bm0dk-lp5g-wmyc-032k-19b9erwf472",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 4,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 22,
    "createdAt": "2025-08-08T13:05:45.563Z",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "320aeks7-c31n-tc0g-3lyh-b0qw1ij86c5",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "yqeal8uo-23z3-hxvd-lrmf-wxi1aj4mywn",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "completedAt": "2025-08-08T13:05:45.563Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "50v3wdkm-i7oh-ko9d-k5ts-7icbzzjtwgp",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "completedAt": "2025-08-08T13:05:45.563Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": false
  }
];

// PERSONAS MOCK DATA
export const personas = [
  {
    "id": "ayz49cj2-1qbk-9qgr-1tb7-wb4jsbad2b",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": "temperature_1",
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "icon": "icon_1",
    "reasoning": "low",
    "active": true
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "k6ymvc68-1mph-6t1f-vee2-m0v0fs9zavm",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": "temperature_1",
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "bf66xsvu-fl3c-9bf6-cia9-bs70pqzz34d",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": "temperature_2",
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "lxwpy2d4-morf-7kbb-1rof-i5f29ighns",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "amsdycxs-7l9x-kob7-w4ap-z91niekblce",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false,
    "active": true
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "tt7efg6y-to7d-d12k-9c2w-7w41bpdcd22",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Parameter_items 1",
    "description": "Description for parameter_items 1",
    "value": "value_1",
    "parameterId": "parameterId_1",
    "defaultItem": "defaultItem_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "n3wqlkk0-kgl0-itye-o4q1-nswcux6rast",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "4tolxvwj-bvv2-25se-7k9m-q5dv5h2vjae",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "personaId": "personaId_2",
    "parameterItemIds": [
      "parameterItemIds_2"
    ],
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "parentId": "parentId_2",
    "active": false
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "j3ugmu3l-vj6n-1f5o-d1xc-bak7vyl073b",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "completedAt": "2025-08-08T13:05:45.563Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "kq5a6ep0-a6lw-9a3a-x7ad-fk9oba36bqp",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "n3wqlkk0-kgl0-itye-o4q1-nswcux6rast",
      "4tolxvwj-bvv2-25se-7k9m-q5dv5h2vjae"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "ebsakffk-wml0-k2rt-xkfg-d1dbqlyrh3u",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "n3wqlkk0-kgl0-itye-o4q1-nswcux6rast",
      "4tolxvwj-bvv2-25se-7k9m-q5dv5h2vjae"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "8rmqu416-1gql-b1vm-nm9p-0o00o1tgkcmj",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "bpticd24-7ghc-ja0f-pv6e-c62eez9hwzb",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "passed": false,
    "score": 93,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "xquksyc7-qoma-86bq-hpg1-t0s4hs69kql",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 40,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "oj2g4opo-2g92-v1b7-thfr-grt2wckivci",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "1849lkqs-yu3j-qax0-x85l-3cauaqa0suu",
      "716o9ak2-5hea-32f6-orek-rhgytgsj6p",
      "9vftlid5-cipy-un59-he7q-y8ul5l8l6d",
      "41kg6nk1-3eb9-xtb2-3rcc-zk27pwhjie"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "kq5a6ep0-a6lw-9a3a-x7ad-fk9oba36bqp",
      "ebsakffk-wml0-k2rt-xkfg-d1dbqlyrh3u"
    ]
  },
  {
    "id": "kurrosh1-bys3-bore-o7tb-o3dmqkgwbsl",
    "createdAt": "2025-08-08T13:05:45.563Z",
    "updatedAt": "2025-08-08T13:05:45.563Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "1849lkqs-yu3j-qax0-x85l-3cauaqa0suu",
      "716o9ak2-5hea-32f6-orek-rhgytgsj6p",
      "9vftlid5-cipy-un59-he7q-y8ul5l8l6d",
      "41kg6nk1-3eb9-xtb2-3rcc-zk27pwhjie"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "kq5a6ep0-a6lw-9a3a-x7ad-fk9oba36bqp",
      "ebsakffk-wml0-k2rt-xkfg-d1dbqlyrh3u"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-08-08T13:05:45.563Z",
    "token": "token_1"
  }
];

