// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 48,
    "userId": 98,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 91,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 39,
    "userId": 64,
    "expires": "2025-08-11T01:14:49.519Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "ialyrets-fja9-583w-ka5p-ta4fiqszwte",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": true,
    "active": true,
    "tags": [
      "tags_1"
    ]
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 2,
    "email": "admin@example.com",
    "emailVerified": "2025-08-11T01:14:49.519Z",
    "image": "image_1"
  },
  {
    "id": 16,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-08-11T01:14:49.519Z",
    "image": "image_2"
  },
  {
    "id": 33,
    "email": "instructor@example.com",
    "image": "image_3"
  },
  {
    "id": 1,
    "name": "TA User",
    "emailVerified": "2025-08-11T01:14:49.519Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "dqtphfxt-abks-h8mp-qtot-qde1900eja8",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "userId": 2,
    "lastLogin": "2025-08-11T01:14:49.519Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-08-11T01:14:49.519Z"
  },
  {
    "id": "kcd9tfo3-6g76-0vdx-spvx-9mrgs8rtj8b",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "lastLogin": "2025-08-11T01:14:49.519Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-08-11T01:14:49.519Z",
    "userId": 16
  },
  {
    "id": "d45ir32e-odka-oxmo-y2x7-4at7d534fx",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "userId": 33,
    "lastLogin": "2025-08-11T01:14:49.519Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-08-11T01:14:49.519Z"
  },
  {
    "id": "ljuep6n0-vctj-0iys-hl2f-oj0ypi7shu",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "userId": 1,
    "lastLogin": "2025-08-11T01:14:49.519Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-08-11T01:14:49.519Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "28z7aydc-241n-e9q2-15h7-au1gk3w3uxw",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "0qph8nva-pqq1-vobn-2it6-3c67n21n8lh",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true,
    "inputPpm": "inputPpm_1",
    "outputPpm": "outputPpm_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "6253wdxi-trep-jhn6-r4wc-dn2jn950fz",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 3,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "utxy6l76-tn02-dckb-0sad-jivpzgrku0m",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 81,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "vd5o8qxp-nn02-ljqv-jb00-llafp02eakj",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 41,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 58,
    "level": "level_1",
    "message": "message_1",
    "createdAt": "2025-08-11T01:14:49.519Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "ts5ff6g8-hyu0-qv4x-2f1m-on3eai6bt7",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 74,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 93,
    "createdAt": "2025-08-11T01:14:49.519Z",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "3cmjl90i-046g-hezh-qr07-1zd72syfkkf",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "by72w7if-5c3c-zu82-xmkl-jbvcw67akqf",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "btm3say4-hgtn-ifea-0z3m-8sm6jx1kazu",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "completedAt": "2025-08-11T01:14:49.519Z",
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
    "id": "scdvcegl-kwxa-rea7-2hep-5hirum8xn5o",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": "temperature_1",
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "icon": "icon_1",
    "modelId": "modelId_1",
    "active": true,
    "guardrailActive": "guardrailActive_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "yghxbmgq-g21e-ng57-3x5x-j4t4w6e0wwq",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": "temperature_1",
    "reasoning": "minimal"
  },
  {
    "id": "lz7d7nl3-f32w-5v9q-ihax-0fno0pboamx",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": "temperature_2",
    "modelId": "modelId_2"
  }
];

// MODELRUNS MOCK DATA
export const modelRuns = [
  {
    "id": "d0gc9pcz-ebmq-8cgc-h7d4-66rviqwdt7o",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "modelId": "modelId_1",
    "inputTokens": "inputTokens_1",
    "outputTokens": "outputTokens_1",
    "personaId": "personaId_1",
    "agentId": "agentId_1",
    "profileId": "profileId_1"
  }
];

// DEBUGINFO MOCK DATA
export const debugInfo = [
  {
    "id": "zp8sp5r0-jlk6-kg25-twoa-n14qqtprrio",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "modelRunId": "modelRunId_1",
    "content": "content_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "rbdxdwhp-3j1p-cper-mql0-dj8mxmoqza",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "1ih96ozk-pap9-fzdc-rpxy-q3rz3xdxmc",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "parameterItemIds": [
      "parameterItemIds_2"
    ],
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "active": false,
    "checkpoints": [
      "checkpoints_2"
    ]
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "szic5ra0-41da-c4dg-195x-281i9gm8wkc",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false,
    "active": true,
    "defaultParameter": "defaultParameter_1"
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "wunv9nsu-wsnf-jh0n-63tg-xv3nire9lp",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "name": "Parameter_items 1",
    "description": "Description for parameter_items 1",
    "value": "value_1",
    "parameterId": "parameterId_1",
    "defaultItem": "defaultItem_1"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "fsqh9ffh-z0nn-f3bm-7aat-y4xywxnrk4c",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "simulationId": "simulationId_1",
    "infiniteMode": "infiniteMode_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "dsmm896w-pn3t-74pl-ofpu-aa590q7exmg",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "rbdxdwhp-3j1p-cper-mql0-dj8mxmoqza",
      "1ih96ozk-pap9-fzdc-rpxy-q3rz3xdxmc"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "78civxc0-mta9-foxe-cufm-mtcwir163l",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "rbdxdwhp-3j1p-cper-mql0-dj8mxmoqza",
      "1ih96ozk-pap9-fzdc-rpxy-q3rz3xdxmc"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "3b6z8bpy-n0ul-8mte-lo2d-18mid7z033q",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "completedAt": "2025-08-11T01:14:49.519Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "vyho0dbb-tg3r-agr3-irku-om8n482184g",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "pbihz5j6-yfek-rlqs-4jz1-pfjrjp8r9md",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "passed": false,
    "score": 62,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1",
    "checkpointsReached": [
      "checkpointsReached_1"
    ]
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "eulj5kyi-qq2h-e7iu-0apr-s30eckf83xk",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 73
  }
];

// SIMULATIONCHATCROWDSOURCEDFEEDBACKS MOCK DATA
export const simulationChatCrowdsourcedFeedbacks = [
  {
    "id": "vmgyocww-5eww-cebc-2l73-6hkwpkaoo8o",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "profileId": "profileId_1",
    "simulationChatFeedbackId": "simulationChatFeedbackId_1",
    "total": 75,
    "feedback": "feedback_1"
  }
];

// SIMULATIONCROWDSOURCEDMESSAGES MOCK DATA
export const simulationCrowdsourcedMessages = [
  {
    "id": "ka281atn-pn4g-93km-fokh-e6bk0d12iui",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "simulationMessageId": "simulationMessageId_1",
    "profileId": "profileId_1",
    "response": true
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "hal3r6mk-pe7r-tn5k-l2i4-iodhusnv3d",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "dqtphfxt-abks-h8mp-qtot-qde1900eja8",
      "kcd9tfo3-6g76-0vdx-spvx-9mrgs8rtj8b",
      "d45ir32e-odka-oxmo-y2x7-4at7d534fx",
      "ljuep6n0-vctj-0iys-hl2f-oj0ypi7shu"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "dsmm896w-pn3t-74pl-ofpu-aa590q7exmg",
      "78civxc0-mta9-foxe-cufm-mtcwir163l"
    ]
  },
  {
    "id": "zrxy0c0t-5xgw-fhvp-y2uq-wbjpa9ltn3g",
    "createdAt": "2025-08-11T01:14:49.519Z",
    "updatedAt": "2025-08-11T01:14:49.519Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "dqtphfxt-abks-h8mp-qtot-qde1900eja8",
      "kcd9tfo3-6g76-0vdx-spvx-9mrgs8rtj8b",
      "d45ir32e-odka-oxmo-y2x7-4at7d534fx",
      "ljuep6n0-vctj-0iys-hl2f-oj0ypi7shu"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "dsmm896w-pn3t-74pl-ofpu-aa590q7exmg",
      "78civxc0-mta9-foxe-cufm-mtcwir163l"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-08-11T01:14:49.519Z",
    "token": "token_1"
  }
];

