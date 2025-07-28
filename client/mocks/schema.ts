// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 62,
    "userId": 37,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "mode": "mode_1",
    "expiresAt": 54,
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 18,
    "userId": 34,
    "expires": "2025-07-28T23:54:06.752Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "v1f0owaa-u8gw-ux2t-9hbl-xmk1ljy0eel",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
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
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-28T23:54:06.752Z",
    "image": "image_1"
  },
  {
    "id": 21,
    "name": "Instructional User",
    "email": "instructional@example.com"
  },
  {
    "id": 20,
    "email": "instructor@example.com",
    "image": "image_3"
  },
  {
    "id": 29,
    "email": "ta@example.com",
    "emailVerified": "2025-07-28T23:54:06.752Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "0jxebgxv-30bc-4f2y-xf0g-ul6buqhne4",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "userId": 1,
    "lastLogin": "2025-07-28T23:54:06.752Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-28T23:54:06.752Z"
  },
  {
    "id": "meun7qnh-jq5j-t896-y3um-cr6bgyh369",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "userId": 21,
    "lastLogin": "2025-07-28T23:54:06.752Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-28T23:54:06.752Z"
  },
  {
    "id": "3intpdtf-6d15-qo2w-jos3-qqc0zeegx8",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "userId": 20,
    "lastLogin": "2025-07-28T23:54:06.752Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-28T23:54:06.752Z"
  },
  {
    "id": "ed73qtqq-uyzd-89kg-aryn-lbq2zbiou4r",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "userId": 29,
    "lastLogin": "2025-07-28T23:54:06.752Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-28T23:54:06.752Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "hf5aqpm7-0wi0-heq0-0hsz-3gwig7dt12q",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "g4yitjt7-7rsk-qw9o-7g8d-sv4xsi5b2jr",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "9cerabjb-kqvd-k5rd-n3dz-pen7vy1jpka",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 95,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "d59blhxn-gdsp-m8qm-2qkc-9wt5x1zsspl",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 35,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "b35dx8gz-czwv-fy7t-q47x-ddp185ldkbo",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 2,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 18,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-28T23:54:06.752Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "5iam4fyi-htbh-2i2f-4x96-571qtxjvrzs",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 42,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 93,
    "createdAt": "2025-07-28T23:54:06.752Z",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "81zp63aq-qnkk-8e41-byn2-j07gi9t8ope",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "o3en3d29-ygxb-uq00-vgvu-vo8lhxdluo",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "completedAt": "2025-07-28T23:54:06.752Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "0agdyshc-s7su-inf0-p0fa-2y8j461gtd7",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "completedAt": "2025-07-28T23:54:06.752Z",
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
    "id": "283yhkvz-emm3-xk1x-u1r3-ev91zuzphx8",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.76,
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
    "id": "7sybfd2b-vi0q-d5tm-evwc-80ozswpf8ty",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.44,
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "hfo2273u-ya17-7iz3-exxt-pwdjgmjlz5d",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.24
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "nqqtc9ni-nehe-rcq6-j372-vkcld3nm54i",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "2tlyxe1l-3raa-febq-u6is-649focawybg",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false,
    "active": true
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "9ufhj4hf-uyu6-kplv-qmqb-r37u388jko",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
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
    "id": "9qo4fffw-aus5-g0az-1wt9-4qs5idful88",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
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
    "generated": true,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "4f2hrj4v-31tc-4hls-vj1f-8cwesdi1nbr",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "personaId": "personaId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "active": false
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "jus0ufcr-pmz8-apt9-j7le-4m56fon75zp",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "completedAt": "2025-07-28T23:54:06.752Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false,
    "traceId": "traceId_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "ehygag1u-kahn-rmoq-pv85-nxtrbr7xlr",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "9qo4fffw-aus5-g0az-1wt9-4qs5idful88",
      "4f2hrj4v-31tc-4hls-vj1f-8cwesdi1nbr"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "zcbx2msv-er9t-7v6t-43zj-21ueywkdvgz",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "9qo4fffw-aus5-g0az-1wt9-4qs5idful88",
      "4f2hrj4v-31tc-4hls-vj1f-8cwesdi1nbr"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "to47ka1l-16hy-3lxl-vywm-gxyian8duk8",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "y7q0n4fn-78z4-xsk7-d2eh-pyvv5wcm6rq",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "passed": true,
    "score": 39,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "bdhi4nte-sows-dugx-v5y7-29rcnboumc3",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 92,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "1eab3a4y-z4vf-vzdi-de1o-gpupi56oue9",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "0jxebgxv-30bc-4f2y-xf0g-ul6buqhne4",
      "meun7qnh-jq5j-t896-y3um-cr6bgyh369",
      "3intpdtf-6d15-qo2w-jos3-qqc0zeegx8",
      "ed73qtqq-uyzd-89kg-aryn-lbq2zbiou4r"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "ehygag1u-kahn-rmoq-pv85-nxtrbr7xlr",
      "zcbx2msv-er9t-7v6t-43zj-21ueywkdvgz"
    ]
  },
  {
    "id": "oains147-xdqu-fagg-0fbf-8h1651u3jgg",
    "createdAt": "2025-07-28T23:54:06.752Z",
    "updatedAt": "2025-07-28T23:54:06.752Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "0jxebgxv-30bc-4f2y-xf0g-ul6buqhne4",
      "meun7qnh-jq5j-t896-y3um-cr6bgyh369",
      "3intpdtf-6d15-qo2w-jos3-qqc0zeegx8",
      "ed73qtqq-uyzd-89kg-aryn-lbq2zbiou4r"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "ehygag1u-kahn-rmoq-pv85-nxtrbr7xlr",
      "zcbx2msv-er9t-7v6t-43zj-21ueywkdvgz"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-28T23:54:06.752Z",
    "token": "token_1"
  }
];

