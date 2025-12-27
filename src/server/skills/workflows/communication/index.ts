/**
 * Communication Skill - Public Exports
 */

export {
  validateCommunicationData,
  createCommunication,
  readCommunication,
  updateCommunication,
  deleteCommunication,
  listCommunications,
  getMissingCommunicationFields,
  getNextCommunicationField,
} from "./handlers";

export {
  COMMUNICATION_FIELD_REGISTRY,
  COMMUNICATION_REQUIRED_FIELD_NAMES,
  COMMUNICATION_EDITABLE_FIELD_NAMES,
} from "./types";
