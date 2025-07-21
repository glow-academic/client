// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 68,
    "userId": 10,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "idToken": "idToken_1",
    "sessionState": "sessionState_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 3,
    "userId": 51,
    "expires": "2025-07-21T20:35:10.204Z"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "x2wtvhm6-jrej-hta7-9sg4-b69yb5h0szk",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 43,
    "name": "Admin User",
    "email": "admin@example.com"
  },
  {
    "id": 44,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-21T20:35:10.204Z"
  },
  {
    "id": 27,
    "email": "instructor@example.com"
  },
  {
    "id": 64,
    "email": "ta@example.com",
    "emailVerified": "2025-07-21T20:35:10.204Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "kdgx9xwk-r1et-kxz9-vyq2-7mxibq2eavf",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "lastLogin": "2025-07-21T20:35:10.204Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "userId": 43
  },
  {
    "id": "twrvkpie-mko2-i5mw-guw1-nli1sxn9dqr",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "lastLogin": "2025-07-21T20:35:10.204Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "userId": 44
  },
  {
    "id": "fjacd8ka-onze-bbyf-xdoy-6ro2vzng0q6",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "lastLogin": "2025-07-21T20:35:10.204Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "userId": 27
  },
  {
    "id": "rn5iay9u-mxj2-54lx-q81b-jtgrb2l1vo",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "userId": 64,
    "lastLogin": "2025-07-21T20:35:10.204Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "l25zjq7m-n4cb-i94y-fsac-5d7v793uoi3",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "biu76r9q-kq0j-3kle-fa7u-wdu08wdfsps",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "dykb70ke-x0mw-dinr-s803-sr1f8488ihr",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 2,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "vx6yucmu-a4g2-mofw-e57r-fcszzem4dou",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 38,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "z80j1thl-q6or-w3as-hqs4-t0n7gaik4dh",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 45,
    "passPoints": "passPoints_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 52,
    "level": "level_1",
    "message": "message_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "xvkpcdum-vfi2-ifpm-8rpt-2xigypa39qz",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 96
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 50,
    "createdAt": "2025-07-21T20:35:10.204Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "w090a48b-e3fp-jes8-acxr-1gy6cseqf1t",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "uupfvcl4-bimm-p0ts-r3p3-2u7rw32nitm",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1"
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "a8x1zsci-lecx-m8c9-m4po-tlk9brc9leg",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "completedAt": "2025-07-21T20:35:10.204Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1"
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "8d5y46nq-cx8c-d3v8-sf2k-lkdm2cld8hn",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": false
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "uqzeqxcg-0krf-n5ds-pbx6-9jza2j8r29h",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "headerComponentIds": [
      "headerComponentIds_1"
    ],
    "primaryComponentIds": [
      "primaryComponentIds_1"
    ],
    "secondaryComponentIds": [
      "secondaryComponentIds_1"
    ],
    "footerComponentIds": [
      "footerComponentIds_1"
    ],
    "autoScroll": "autoScroll_1",
    "showIndicators": "showIndicators_1",
    "headerComponents": "headerComponents_1",
    "mainSplit": "mainSplit_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "5rcqster-4drp-y1yu-qd2f-xqtzvwtv0j",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.2,
    "defaultAgent": "defaultAgent_1",
    "color": "color_1"
  },
  {
    "id": "70zhd28q-80tx-e4pu-47pl-uvvweh8wac9",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0,
    "defaultAgent": "defaultAgent_2",
    "color": "color_2",
    "modelId": "modelId_2"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "xofixmuq-i7qc-umxy-pdv6-tpv1lh9082",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.92,
    "modelId": "modelId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "kd6sqkhf-tl2p-qymd-0grl-kxci0qjgx",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "crowdedness": 90,
    "classId": "classId_1",
    "locationId": "locationId_1",
    "deadlineId": "deadlineId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "parentId": "parentId_1"
  },
  {
    "id": "7dh35w16-dfpk-500y-2q0p-8rcvz8ztas",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "intensity": 3,
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false
  }
];

// SCENARIOCLASSES MOCK DATA
export const scenarioClasses = [
  {
    "id": "u5nkcfja-y3ef-k9qm-5o7h-s6q6qrg6v7b",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Scenario_classes 1",
    "classCode": "classCode_1"
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "96oc31oj-6tov-n87f-9i66-phpxbmwg23",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "name": "Scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "s7tn3u9y-oibl-ff3u-qmmz-vquh41c2ydb",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "deadline": "deadline_1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "7nhlz1rm-02p8-5qhl-ay9e-sc8n8ylli4",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "timeOfDay": "timeOfDay_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "elfelzm7-au0t-y7ot-ctr0-agmlpcqxark",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "kd6sqkhf-tl2p-qymd-0grl-kxci0qjgx",
      "7dh35w16-dfpk-500y-2q0p-8rcvz8ztas"
    ],
    "rubricId": "rubricId_1"
  },
  {
    "id": "vtqogqnd-oahw-9lqe-l2tn-vjcesyumkpd",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "kd6sqkhf-tl2p-qymd-0grl-kxci0qjgx",
      "7dh35w16-dfpk-500y-2q0p-8rcvz8ztas"
    ],
    "rubricId": "rubricId_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "cyfv686q-4el5-0dac-7nyc-aa2fu3rrn94",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "profileId": "profileId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "86fo1501-ymii-sq1u-t6do-25ullscqa1u",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "completedAt": "2025-07-21T20:35:10.204Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "q29x1pix-xphv-hz6n-3cyw-kup4wwrw6mg",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query"
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "jord0ywv-355i-y46x-1fd4-22e54u5jo78j",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "passed": true,
    "score": 5,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "fmp086ql-fn3q-bydv-ta89-3a82bq7mxqi",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 74
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "gggwlld6-1nk3-atj4-8jwv-eyvlwwdf3",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "kdgx9xwk-r1et-kxz9-vyq2-7mxibq2eavf",
      "twrvkpie-mko2-i5mw-guw1-nli1sxn9dqr",
      "fjacd8ka-onze-bbyf-xdoy-6ro2vzng0q6",
      "rn5iay9u-mxj2-54lx-q81b-jtgrb2l1vo"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "rptlaml1-bagt-yn1b-fx7t-6n53ahjs2bh",
    "createdAt": "2025-07-21T20:35:10.204Z",
    "updatedAt": "2025-07-21T20:35:10.204Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "kdgx9xwk-r1et-kxz9-vyq2-7mxibq2eavf",
      "twrvkpie-mko2-i5mw-guw1-nli1sxn9dqr",
      "fjacd8ka-onze-bbyf-xdoy-6ro2vzng0q6",
      "rn5iay9u-mxj2-54lx-q81b-jtgrb2l1vo"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-21T20:35:10.204Z"
  }
];

