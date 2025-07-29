// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 71,
    "userId": 52,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "mode": "mode_1",
    "idToken": "idToken_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 65,
    "userId": 71,
    "expires": "2025-07-29T00:09:07.605Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "thc7y0qo-ekzj-f8t4-79kp-s98i1h7l7q9",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 16,
    "name": "Admin User",
    "emailVerified": "2025-07-29T00:09:07.605Z",
    "image": "image_1"
  },
  {
    "id": 93,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-29T00:09:07.605Z",
    "image": "image_2"
  },
  {
    "id": 59,
    "email": "instructor@example.com",
    "emailVerified": "2025-07-29T00:09:07.605Z",
    "image": "image_3"
  },
  {
    "id": 98,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-29T00:09:07.605Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "d2fyo0xm-95r2-tajy-o4n8-fxk16wvu1j",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "userId": 16,
    "lastLogin": "2025-07-29T00:09:07.605Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-29T00:09:07.605Z"
  },
  {
    "id": "u9f4eerq-dz7g-shp5-i9iv-ec99v4pdasb",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "userId": 93,
    "lastLogin": "2025-07-29T00:09:07.605Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-29T00:09:07.605Z"
  },
  {
    "id": "o74qtpj5-35ko-6vbp-s3ax-mvw86elaqxi",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "userId": 59,
    "lastLogin": "2025-07-29T00:09:07.605Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-29T00:09:07.605Z"
  },
  {
    "id": "ts6pxt57-3yfu-wjo0-j5ly-3hrcbibt9yp",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "userId": 98,
    "lastLogin": "2025-07-29T00:09:07.605Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-29T00:09:07.605Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "ycsztat6-tr12-rhds-iqo7-08gz8lw089ls",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "avqk5pc0-08w3-otah-7vx6-i9b87vv8rs",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "lj77ralh-fijk-aas5-1p3p-qsbkklsts9",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 100,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "ohl88c2m-6i63-ua6d-hs8v-ed3vfkmcll",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 38,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "cghmn9fh-wgvc-59e7-1b3e-49bocvwnfnn",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 18,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 63,
    "level": "level_1",
    "createdAt": "2025-07-29T00:09:07.605Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "t8mr7y9p-lpm7-6bi3-8jkz-qofctgkgc6e",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 19,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 71,
    "createdAt": "2025-07-29T00:09:07.605Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "hy6b6q1p-wvf4-4baw-u2fh-pylg7rp68dg",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "c8298t04-457g-ng7b-9ur2-0tnfpxznyth",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "completedAt": "2025-07-29T00:09:07.605Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "e0srnhnr-4wum-18b9-o72p-qu6zxmmj2c",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "completedAt": "2025-07-29T00:09:07.605Z",
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
    "id": "1xwcatx4-ggjs-1dwi-itn7-ibssjb1mf1",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.58,
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
    "id": "7zbxvcni-po4m-7883-oiy4-y7cvzw7yhjp",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.43,
    "reasoning": "low"
  },
  {
    "id": "0trad2zh-t8v7-a00y-86q5-ymr1bj3y55a",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.78,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "7eqwj6ke-45su-yzdq-ycpc-z4xd65rqpxq",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "auk5zg9u-tcu3-42qp-e7kb-5yb8j4t2vzu",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false,
    "active": true
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "wfrmaw0s-y0s1-51q9-r6uz-l5qbc26raog",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
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
    "id": "f57zevwe-8rt0-z7r8-90am-hyiwljxomnh",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
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
    "active": true
  },
  {
    "id": "jndsypud-3tae-29a9-b06y-ax6vr5hws1f",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
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
    "active": false
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "5r41gxuc-c7zg-m5jz-93f3-qiimpzb9fg9",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "completedAt": "2025-07-29T00:09:07.605Z",
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
    "id": "bnh4z9h1-pnzv-xh47-jnuh-6foyxgldap3",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "f57zevwe-8rt0-z7r8-90am-hyiwljxomnh",
      "jndsypud-3tae-29a9-b06y-ax6vr5hws1f"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "75au0y20-0erb-e89v-7bvq-k52e823l1f8",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "f57zevwe-8rt0-z7r8-90am-hyiwljxomnh",
      "jndsypud-3tae-29a9-b06y-ax6vr5hws1f"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "xon5etwg-aid2-qwav-u6kz-mgxu1javixr",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "oa31dtkc-pate-p5da-wscw-8c0y8dl55vl",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "passed": true,
    "score": 32,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "33p22a3s-xcbt-vtdj-byrd-58mm8k1k3ir",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 42
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "cbc3zkr0-82vr-4qus-8mgw-cg81u1pmeda",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "d2fyo0xm-95r2-tajy-o4n8-fxk16wvu1j",
      "u9f4eerq-dz7g-shp5-i9iv-ec99v4pdasb",
      "o74qtpj5-35ko-6vbp-s3ax-mvw86elaqxi",
      "ts6pxt57-3yfu-wjo0-j5ly-3hrcbibt9yp"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "bnh4z9h1-pnzv-xh47-jnuh-6foyxgldap3",
      "75au0y20-0erb-e89v-7bvq-k52e823l1f8"
    ]
  },
  {
    "id": "5unal46y-4915-pumf-kkgf-h6ommf8ro4",
    "createdAt": "2025-07-29T00:09:07.605Z",
    "updatedAt": "2025-07-29T00:09:07.605Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "d2fyo0xm-95r2-tajy-o4n8-fxk16wvu1j",
      "u9f4eerq-dz7g-shp5-i9iv-ec99v4pdasb",
      "o74qtpj5-35ko-6vbp-s3ax-mvw86elaqxi",
      "ts6pxt57-3yfu-wjo0-j5ly-3hrcbibt9yp"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "bnh4z9h1-pnzv-xh47-jnuh-6foyxgldap3",
      "75au0y20-0erb-e89v-7bvq-k52e823l1f8"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-29T00:09:07.605Z",
    "token": "token_1"
  }
];

