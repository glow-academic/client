// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 40,
    "userId": 12,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 33,
    "scope": "scope_1",
    "sessionState": "sessionState_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 92,
    "userId": 91,
    "expires": "2025-07-21T19:35:32.868Z"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "lyyb2zfy-q33g-ye88-4n4u-ngcght6o34k",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 59,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-21T19:35:32.868Z"
  },
  {
    "id": 39,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-21T19:35:32.868Z"
  },
  {
    "id": 49,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-07-21T19:35:32.868Z"
  },
  {
    "id": 28,
    "name": "TA User"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "fr0wx7co-6mxo-3ehc-bfn4-2856lqpqo6y",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "userId": 59,
    "lastLogin": "2025-07-21T19:35:32.868Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true
  },
  {
    "id": "h9628ptr-c7fq-nvgu-n7o8-5c5v4e90b42",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "lastLogin": "2025-07-21T19:35:32.868Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "userId": 39
  },
  {
    "id": "ccwtnvr6-1xr6-79r0-t739-nhbcaidd36",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "userId": 49,
    "lastLogin": "2025-07-21T19:35:32.868Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false
  },
  {
    "id": "fwepylic-581n-aczc-927b-x0rmmrsmknj",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "userId": 28,
    "lastLogin": "2025-07-21T19:35:32.868Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "nnv5mt5b-74ex-jwfh-rtes-37ca2ka99m6",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "0ha2ipvg-9k0d-bapd-v7m9-x5rift1w3ba",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "3w8g7y0h-j83d-8imk-ekmp-ecza4rc2z5b",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 90,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "dyx4ibb6-ergj-rprx-osrv-pp39s8z4rt",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 2,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "bmv5fy8n-zllk-fic0-o97z-x0frel9bun",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 73,
    "passPoints": "passPoints_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 83,
    "level": "level_1",
    "message": "message_1",
    "context": {}
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "hyliqsxt-qwbn-9uis-baf9-8pmpvledg0l",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 94
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 63,
    "createdAt": "2025-07-21T19:35:32.868Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "fptbndvj-3sml-f18b-dnsy-n030d4vj9cj",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "z6b5ufvn-fu49-76je-48bk-a4zvszg860f",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "completedAt": "2025-07-21T19:35:32.868Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1"
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "lswt273l-8vw3-13wt-yceo-6zytuy57x4e",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
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
    "id": "wmslngmf-tr9w-k9kr-spvu-5q6ph9gbcz6",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
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
    "id": "xnyhojkb-ce4b-yjju-vgga-2agrl65l1ao",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "profileId": "profileId_1",
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
    "id": "z6a185qf-5j0m-tsnd-kiun-onfxl2rljb",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.57,
    "defaultAgent": "defaultAgent_1",
    "color": "color_1",
    "modelId": "modelId_1"
  },
  {
    "id": "lmc0qgta-zn1r-j27n-sb7u-ekmdvxlo1v",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.1,
    "defaultAgent": "defaultAgent_2",
    "color": "color_2",
    "modelId": "modelId_2"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "57jw9tfk-brpj-9egj-h3ps-zjhrfeqqbzs",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.35,
    "modelId": "modelId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "s9d14q7b-1l1j-62j2-zlth-5upclb2y6dd",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "locationId": "locationId_1",
    "deadlineId": "deadlineId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true
  },
  {
    "id": "l1xiae44-c32i-knbi-k3pc-ip549qi67m",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "intensity": 48,
    "classId": "classId_2",
    "locationId": "locationId_2",
    "deadlineId": "deadlineId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "parentId": "parentId_2"
  }
];

// SCENARIOCLASSES MOCK DATA
export const scenarioClasses = [
  {
    "id": "1n1fpked-7ldl-3d23-zqht-395p1w52a1s",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "Scenario_classes 1",
    "classCode": "classCode_1"
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "heu5kx6e-zwip-7ky4-ytf4-tcfa7xq7smo",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "name": "Scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "g314gb5m-0jmt-b14q-dweq-hiho47fkf9n",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "deadline": "deadline_1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "nu9wpirk-7kan-psn7-8jka-icpulid8mlq",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "timeOfDay": "timeOfDay_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "t1jullxh-8w29-cp2k-p1jh-weohdp2pfok",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "s9d14q7b-1l1j-62j2-zlth-5upclb2y6dd",
      "l1xiae44-c32i-knbi-k3pc-ip549qi67m"
    ],
    "rubricId": "rubricId_1"
  },
  {
    "id": "6y3pe7qe-f26b-h377-69im-3ar3fp4xcsq",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "s9d14q7b-1l1j-62j2-zlth-5upclb2y6dd",
      "l1xiae44-c32i-knbi-k3pc-ip549qi67m"
    ],
    "rubricId": "rubricId_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "oqsr5w2i-w10g-p9rw-pxu2-sgp9sccjzhr",
    "createdAt": "2025-07-21T19:35:32.868Z"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "pkrcf5d0-c1ss-uqsi-x5v9-cnt4jwpxex",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "completedAt": "2025-07-21T19:35:32.868Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "jj3m02ou-kp2a-hfef-gjvg-j5os1iei89",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query"
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "dd7nq970-g3mg-cujd-sw2b-aaqn3ftfu6o",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "passed": true,
    "score": 81,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "ch1jzxno-ht6j-mu0n-raw8-3pbqs5pe9sn",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 59
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "wh2oyasj-nz91-3yxh-6xih-kel6ps1oa6h",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "fr0wx7co-6mxo-3ehc-bfn4-2856lqpqo6y",
      "h9628ptr-c7fq-nvgu-n7o8-5c5v4e90b42",
      "ccwtnvr6-1xr6-79r0-t739-nhbcaidd36",
      "fwepylic-581n-aczc-927b-x0rmmrsmknj"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "lv4qiyns-wjwu-yq5p-ymkg-0tu87z3z092k",
    "createdAt": "2025-07-21T19:35:32.868Z",
    "updatedAt": "2025-07-21T19:35:32.868Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "fr0wx7co-6mxo-3ehc-bfn4-2856lqpqo6y",
      "h9628ptr-c7fq-nvgu-n7o8-5c5v4e90b42",
      "ccwtnvr6-1xr6-79r0-t739-nhbcaidd36",
      "fwepylic-581n-aczc-927b-x0rmmrsmknj"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-21T19:35:32.868Z"
  }
];

