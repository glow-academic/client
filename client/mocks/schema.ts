// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 5,
    "userId": 36,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "idToken": "idToken_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 32,
    "userId": 35,
    "expires": "2025-08-07T19:43:46.050Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "yvdrtdps-anwa-gs5t-mvw7-s05mnyha6pk",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": false,
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 77,
    "name": "Admin User",
    "image": "image_1"
  },
  {
    "id": 43,
    "email": "instructional@example.com",
    "emailVerified": "2025-08-07T19:43:46.050Z"
  },
  {
    "id": 18,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-08-07T19:43:46.050Z",
    "image": "image_3"
  },
  {
    "id": 58,
    "name": "TA User",
    "emailVerified": "2025-08-07T19:43:46.050Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "8xdkeem6-rcog-9947-vkks-9s2clow45xj",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "userId": 77,
    "lastLogin": "2025-08-07T19:43:46.050Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-08-07T19:43:46.050Z"
  },
  {
    "id": "4t7ho6kq-yu7u-wa0j-ymk8-wrsuceu092",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "userId": 43,
    "lastLogin": "2025-08-07T19:43:46.050Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-08-07T19:43:46.050Z"
  },
  {
    "id": "uwpqqmsc-95y2-hvq7-psqd-6a4ai4voyit",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "userId": 18,
    "lastLogin": "2025-08-07T19:43:46.050Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-08-07T19:43:46.050Z"
  },
  {
    "id": "vgm199qh-ajt5-d42v-2dpw-9mk1s2mdnv7",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "userId": 58,
    "lastLogin": "2025-08-07T19:43:46.050Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-08-07T19:43:46.050Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "svmptn9t-vbhx-tjiw-omdz-t75h8l61qvq",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "9fcakv6y-lcoh-xq94-8oor-zy5r593dh7a",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "tgmws04y-7x46-vx7w-8gu8-ntgqh19qwrd",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 48,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "rkc4xyg0-tfr9-djbj-vqrr-461181ityui",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 60,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "zfcjb7hi-63yw-ihj2-sjqw-woxdo86kaea",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 7,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 25,
    "level": "level_1",
    "createdAt": "2025-08-07T19:43:46.050Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "stp97f76-ojai-y9d5-jgsq-89vmo4d9nbb",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 25,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 59,
    "createdAt": "2025-08-07T19:43:46.050Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "avjzhqas-38e9-rhrc-4d04-7vb73vn62ou",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "ia1s8dmn-4ljd-th70-qe1v-gr2kjrxbcks",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "2etfpvl2-23z3-4huw-oili-j7sinn8ttq",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "completedAt": "2025-08-07T19:43:46.050Z",
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
    "id": "r3c87zq1-b2rd-xd91-x8e9-j5emre2mt4i",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": "temperature_1",
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
    "id": "51nj9kcl-pn59-verg-xbrv-c02r249lmnq",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": "temperature_1"
  },
  {
    "id": "ud4aesvc-d4ci-vcu9-90kz-8rs3pldmbm7",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": "temperature_2",
    "modelId": "modelId_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "ip8idsgh-xj36-kafi-i1ha-7xbrp9t93hj",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "sh3ty8so-idfg-27ua-mj0l-knbms8g2fo",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false,
    "active": true
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "zwfq086y-hoen-rkhj-fqt5-hmpuybp6ct7",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
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
    "id": "bdli66yc-3lls-wu6y-btpo-3zinwt62jyl",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
    "parameterItemIds": [
      "parameterItemIds_1"
    ],
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "jrsw6lyw-7fhd-hd3z-ml0q-9f4y8vl0s1i",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
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
    "generated": true,
    "active": false
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "moii8az7-78uf-2ta2-qvgl-55lbsq7fahs",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "completedAt": "2025-08-07T19:43:46.050Z",
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
    "id": "988z6952-t5a5-t1vq-rdke-32rwjk4uzmt",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "bdli66yc-3lls-wu6y-btpo-3zinwt62jyl",
      "jrsw6lyw-7fhd-hd3z-ml0q-9f4y8vl0s1i"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "mj0ih1pw-5ttr-ldr3-mop9-bzjj2z1n8fa",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "bdli66yc-3lls-wu6y-btpo-3zinwt62jyl",
      "jrsw6lyw-7fhd-hd3z-ml0q-9f4y8vl0s1i"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "qml33j22-siwv-mb5u-6ki5-tzu63xfc26r",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "42vz4mjf-y723-d9bz-pe5c-d2wkvn04myw",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "passed": true,
    "score": 42,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "hciqswdq-xg4u-efha-w9o6-w7qopgkugzm",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 46,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "qj2x6z4y-upho-vadr-aak1-giusakuvri8",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "8xdkeem6-rcog-9947-vkks-9s2clow45xj",
      "4t7ho6kq-yu7u-wa0j-ymk8-wrsuceu092",
      "uwpqqmsc-95y2-hvq7-psqd-6a4ai4voyit",
      "vgm199qh-ajt5-d42v-2dpw-9mk1s2mdnv7"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "988z6952-t5a5-t1vq-rdke-32rwjk4uzmt",
      "mj0ih1pw-5ttr-ldr3-mop9-bzjj2z1n8fa"
    ]
  },
  {
    "id": "vfrksjig-q9am-bkcn-4c99-3z5tiybmgxc",
    "createdAt": "2025-08-07T19:43:46.050Z",
    "updatedAt": "2025-08-07T19:43:46.050Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "8xdkeem6-rcog-9947-vkks-9s2clow45xj",
      "4t7ho6kq-yu7u-wa0j-ymk8-wrsuceu092",
      "uwpqqmsc-95y2-hvq7-psqd-6a4ai4voyit",
      "vgm199qh-ajt5-d42v-2dpw-9mk1s2mdnv7"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "988z6952-t5a5-t1vq-rdke-32rwjk4uzmt",
      "mj0ih1pw-5ttr-ldr3-mop9-bzjj2z1n8fa"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-08-07T19:43:46.050Z",
    "token": "token_1"
  }
];

