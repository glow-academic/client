// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 39,
    "userId": 37,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 60,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 39,
    "userId": 70,
    "expires": "2025-07-27T01:54:18.643Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "0m60kjt1-4s2e-15pm-ad5d-gnm8x7ekrf5",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 78,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-27T01:54:18.643Z",
    "image": "image_1"
  },
  {
    "id": 27,
    "name": "Instructional User",
    "email": "instructional@example.com"
  },
  {
    "id": 52,
    "emailVerified": "2025-07-27T01:54:18.643Z",
    "image": "image_3"
  },
  {
    "id": 73,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-27T01:54:18.643Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "bxxasqo5-dhhn-jvhz-mga3-ma2ix2fij9",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "userId": 78,
    "lastLogin": "2025-07-27T01:54:18.643Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-27T01:54:18.643Z"
  },
  {
    "id": "70nzgx4a-bgvc-qjgb-h7s6-3sbd10vf095",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "userId": 27,
    "lastLogin": "2025-07-27T01:54:18.643Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-27T01:54:18.643Z"
  },
  {
    "id": "ja7i3rn8-74fz-suy1-mss2-vsb1rxvdmni",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "userId": 52,
    "lastLogin": "2025-07-27T01:54:18.643Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-27T01:54:18.643Z"
  },
  {
    "id": "gpcms87z-mcas-e59s-r9xw-uhlca3tdzp",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "userId": 73,
    "lastLogin": "2025-07-27T01:54:18.643Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-27T01:54:18.643Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "nnoh23og-luta-w9m4-yt8m-20bej2qfbg9",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "pgsay6oz-sc7t-q712-geux-30bfwi0j4mh",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "2j3b8m9x-e8gv-sjtp-4ods-x5w0qrdpat",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 85,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "5c9d935i-l0gz-pug1-m8qu-x7dra17m8kj",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 59,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "f0wz355o-uv67-apcq-dudv-vbprsvvxat",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 10,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 65,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-27T01:54:18.643Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "pmuthnti-30ea-qfvx-nh7f-ywjep241ucd",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 63,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 34,
    "createdAt": "2025-07-27T01:54:18.643Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "vtawp8am-t6v0-hxuh-lmd0-15b86890qs6",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "2gb4vpes-qku7-yy08-njnm-dqqpfdmux8",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "completedAt": "2025-07-27T01:54:18.643Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "j8r93r6i-nkyo-omz7-tc7z-l8cjg9ueqz",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "completedAt": "2025-07-27T01:54:18.643Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": true
  }
];

// PERSONAS MOCK DATA
export const personas = [
  {
    "id": "3ke1hqeg-tl3p-cqgo-e0pw-3jmjjgp8zg",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.18,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "icon": "icon_1",
    "modelId": "modelId_1",
    "reasoning": "low",
    "active": true
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "4bm6m8kh-s9yo-4mri-8fy1-0qiy702loct",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.49,
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "9aafeae8-6cgy-n6nm-k3wk-3js3tjk53k4",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.01,
    "modelId": "modelId_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "7hk3ddm2-qt6t-ui5f-onpc-zacd7h3oac",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "u06i8oux-ett8-1e42-7ypt-s32gwf6o33",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false,
    "active": true
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "4i8lxx94-w7yw-z0db-yqqd-gncuzqau7x5",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
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
    "id": "eca3n264-18kl-slsf-5ckq-v9tihdi9nu",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "parameterItemIds": [
      "parameterItemIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "active": true
  },
  {
    "id": "f8ch5wau-4ft7-r9mz-w5zs-c8cyrze9xfg",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
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
    "id": "tip2ipu0-beg0-nvpm-4b6v-2khcig4pdok",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "completedAt": "2025-07-27T01:54:18.643Z",
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
    "id": "s36yq6bm-jmaa-jbvr-ow9f-k0gk9c14z",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "eca3n264-18kl-slsf-5ckq-v9tihdi9nu",
      "f8ch5wau-4ft7-r9mz-w5zs-c8cyrze9xfg"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "fzkthewg-7eca-ggtr-tuka-169gib8wz5z",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "eca3n264-18kl-slsf-5ckq-v9tihdi9nu",
      "f8ch5wau-4ft7-r9mz-w5zs-c8cyrze9xfg"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "s7r080n6-k5ha-er4f-i4k4-wqspa5mji",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "g9dhgzpc-6i02-4tvj-jqfq-luaeze5h68s",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "passed": true,
    "score": 61,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "afuksujw-3cvv-l92h-yk58-15mjq9ytgmg",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 86,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "qvomx02w-kx3c-tln2-uifx-cg6cdj969jr",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "bxxasqo5-dhhn-jvhz-mga3-ma2ix2fij9",
      "70nzgx4a-bgvc-qjgb-h7s6-3sbd10vf095",
      "ja7i3rn8-74fz-suy1-mss2-vsb1rxvdmni",
      "gpcms87z-mcas-e59s-r9xw-uhlca3tdzp"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "s36yq6bm-jmaa-jbvr-ow9f-k0gk9c14z",
      "fzkthewg-7eca-ggtr-tuka-169gib8wz5z"
    ]
  },
  {
    "id": "z5afgfh0-t48f-h4rr-eudi-nftf6a9p38i",
    "createdAt": "2025-07-27T01:54:18.643Z",
    "updatedAt": "2025-07-27T01:54:18.643Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "bxxasqo5-dhhn-jvhz-mga3-ma2ix2fij9",
      "70nzgx4a-bgvc-qjgb-h7s6-3sbd10vf095",
      "ja7i3rn8-74fz-suy1-mss2-vsb1rxvdmni",
      "gpcms87z-mcas-e59s-r9xw-uhlca3tdzp"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "s36yq6bm-jmaa-jbvr-ow9f-k0gk9c14z",
      "fzkthewg-7eca-ggtr-tuka-169gib8wz5z"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-27T01:54:18.643Z",
    "token": "token_1"
  }
];

