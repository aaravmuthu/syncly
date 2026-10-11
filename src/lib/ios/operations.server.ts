// Explicit allowlist. No user-controlled module or export resolution.
// addSpotToPlan, castResolutionVote and applyAiCompromise are withheld until
// their server handlers independently enforce hard-constraint feasibility.
import { getEmailSecurity, sendEmailSecondFactor, verifyEmailSecondFactor } from "@/lib/email-mfa.functions";
import { acceptTerms, exportAccountData } from "@/lib/quorum/account.functions";
import { magicPlanDraft, getCompromiseSummaries, getPlanBSuggestion, getAiCompromise } from "@/lib/quorum/ai.functions";
import { askPlanConcierge, getSquadDigest, vibeSearchSpots, getGuardianAiSummary, askSyncly } from "@/lib/quorum/aiplus.functions";
import { listMessages, sendMessage, markRead, uploadChatImage, postRideUpdate } from "@/lib/quorum/chat.functions";
import { getPlanConflicts, flagConflict, runConflictSweep, confirmAttendance } from "@/lib/quorum/conflict.functions";
import { openThread, listInbox, getThread, sendDirect, markThreadRead, toggleReaction, listContacts, uploadVoiceNote } from "@/lib/quorum/dm.functions";
import { getMyFamilyPlan, startFamilyPlus, cancelFamilyPlus } from "@/lib/quorum/family-plan.functions";
import { getFriendProfile, getNicknames, setNickname, setContactGhost, requestLocation } from "@/lib/quorum/friend.functions";
import { leaveGroup, transferGroupOwnership, deleteGroup, updateGroupLook, uploadGroupImage } from "@/lib/quorum/group.functions";
import { getMySyncCode, linkTeen, getMyLinkRequests, answerLinkRequest, unlinkGuardian, getMyGuardians, getGuardianHub, setLocationSharing, pushLocation, addSafeZone, removeSafeZone, decidePlanApproval, askForCheckin, respondToCheckin, getMyCheckins, sendDelay, raiseSos, markRideLeaving, saveVehicleDetails, markAlertsRead, getMyRadar, arrivedSafely } from "@/lib/quorum/guardian.functions";
import { getAvailabilityHeatmap, getPlanWeather, listNotifications, markNotificationsRead, getGroupMemory } from "@/lib/quorum/insight.functions";
import { startItinerary, scoutItineraryStop, itineraryForecast, launchItinerary } from "@/lib/quorum/itinerary.functions";
import { geocodeZip, suggestPlaces, searchMapPlaces, reverseZip, nearbyMapPlaces } from "@/lib/quorum/location.functions";
import { getMe, saveProfile, uploadAvatar, deleteAccount, listGroups, createGroup, joinGroup, getGroup, listPlans, getDashboard, listActivity, createPlan, getPlan, submitConstraints, generateRecommendations, castVote, finalizePlan, requestParentApproval, getSummaryShareLink } from "@/lib/quorum/plan.functions";
import { getPlanDefaults, previewFairPointVenues, launchAiPlan } from "@/lib/quorum/planner.functions";
import { getVenueInsight } from "@/lib/quorum/reviews.functions";
import { getFriendPins, getSharePeers, getSharingState, shareLocationWith, stopSharingWith, stopWatchingFriend, setGhostMode, nudgeFriendPin } from "@/lib/quorum/sharing.functions";
import { browseSpots, saveSpot, unsaveSpot, listSavedSpots } from "@/lib/quorum/spots.functions";

type Callable = (options: { data: never; headers: Headers }) => Promise<unknown>;
const handlers: Record<string, Callable> = Object.assign(Object.create(null), {
  getEmailSecurity: getEmailSecurity as unknown as Callable,
  sendEmailSecondFactor: sendEmailSecondFactor as unknown as Callable,
  verifyEmailSecondFactor: verifyEmailSecondFactor as unknown as Callable,
  acceptTerms: acceptTerms as unknown as Callable,
  exportAccountData: exportAccountData as unknown as Callable,
  magicPlanDraft: magicPlanDraft as unknown as Callable,
  getCompromiseSummaries: getCompromiseSummaries as unknown as Callable,
  getPlanBSuggestion: getPlanBSuggestion as unknown as Callable,
  getAiCompromise: getAiCompromise as unknown as Callable,
  askPlanConcierge: askPlanConcierge as unknown as Callable,
  getSquadDigest: getSquadDigest as unknown as Callable,
  vibeSearchSpots: vibeSearchSpots as unknown as Callable,
  getGuardianAiSummary: getGuardianAiSummary as unknown as Callable,
  askSyncly: askSyncly as unknown as Callable,
  listMessages: listMessages as unknown as Callable,
  sendMessage: sendMessage as unknown as Callable,
  markRead: markRead as unknown as Callable,
  uploadChatImage: uploadChatImage as unknown as Callable,
  postRideUpdate: postRideUpdate as unknown as Callable,
  getPlanConflicts: getPlanConflicts as unknown as Callable,
  flagConflict: flagConflict as unknown as Callable,
  runConflictSweep: runConflictSweep as unknown as Callable,
  confirmAttendance: confirmAttendance as unknown as Callable,
  openThread: openThread as unknown as Callable,
  listInbox: listInbox as unknown as Callable,
  getThread: getThread as unknown as Callable,
  sendDirect: sendDirect as unknown as Callable,
  markThreadRead: markThreadRead as unknown as Callable,
  toggleReaction: toggleReaction as unknown as Callable,
  listContacts: listContacts as unknown as Callable,
  uploadVoiceNote: uploadVoiceNote as unknown as Callable,
  getMyFamilyPlan: getMyFamilyPlan as unknown as Callable,
  startFamilyPlus: startFamilyPlus as unknown as Callable,
  cancelFamilyPlus: cancelFamilyPlus as unknown as Callable,
  getFriendProfile: getFriendProfile as unknown as Callable,
  getNicknames: getNicknames as unknown as Callable,
  setNickname: setNickname as unknown as Callable,
  setContactGhost: setContactGhost as unknown as Callable,
  requestLocation: requestLocation as unknown as Callable,
  leaveGroup: leaveGroup as unknown as Callable,
  transferGroupOwnership: transferGroupOwnership as unknown as Callable,
  deleteGroup: deleteGroup as unknown as Callable,
  updateGroupLook: updateGroupLook as unknown as Callable,
  uploadGroupImage: uploadGroupImage as unknown as Callable,
  getMySyncCode: getMySyncCode as unknown as Callable,
  linkTeen: linkTeen as unknown as Callable,
  getMyLinkRequests: getMyLinkRequests as unknown as Callable,
  answerLinkRequest: answerLinkRequest as unknown as Callable,
  unlinkGuardian: unlinkGuardian as unknown as Callable,
  getMyGuardians: getMyGuardians as unknown as Callable,
  getGuardianHub: getGuardianHub as unknown as Callable,
  setLocationSharing: setLocationSharing as unknown as Callable,
  pushLocation: pushLocation as unknown as Callable,
  addSafeZone: addSafeZone as unknown as Callable,
  removeSafeZone: removeSafeZone as unknown as Callable,
  decidePlanApproval: decidePlanApproval as unknown as Callable,
  askForCheckin: askForCheckin as unknown as Callable,
  respondToCheckin: respondToCheckin as unknown as Callable,
  getMyCheckins: getMyCheckins as unknown as Callable,
  sendDelay: sendDelay as unknown as Callable,
  raiseSos: raiseSos as unknown as Callable,
  markRideLeaving: markRideLeaving as unknown as Callable,
  saveVehicleDetails: saveVehicleDetails as unknown as Callable,
  markAlertsRead: markAlertsRead as unknown as Callable,
  getMyRadar: getMyRadar as unknown as Callable,
  arrivedSafely: arrivedSafely as unknown as Callable,
  getAvailabilityHeatmap: getAvailabilityHeatmap as unknown as Callable,
  getPlanWeather: getPlanWeather as unknown as Callable,
  listNotifications: listNotifications as unknown as Callable,
  markNotificationsRead: markNotificationsRead as unknown as Callable,
  getGroupMemory: getGroupMemory as unknown as Callable,
  startItinerary: startItinerary as unknown as Callable,
  scoutItineraryStop: scoutItineraryStop as unknown as Callable,
  itineraryForecast: itineraryForecast as unknown as Callable,
  launchItinerary: launchItinerary as unknown as Callable,
  geocodeZip: geocodeZip as unknown as Callable,
  suggestPlaces: suggestPlaces as unknown as Callable,
  searchMapPlaces: searchMapPlaces as unknown as Callable,
  reverseZip: reverseZip as unknown as Callable,
  nearbyMapPlaces: nearbyMapPlaces as unknown as Callable,
  getMe: getMe as unknown as Callable,
  saveProfile: saveProfile as unknown as Callable,
  uploadAvatar: uploadAvatar as unknown as Callable,
  deleteAccount: deleteAccount as unknown as Callable,
  listGroups: listGroups as unknown as Callable,
  createGroup: createGroup as unknown as Callable,
  joinGroup: joinGroup as unknown as Callable,
  getGroup: getGroup as unknown as Callable,
  listPlans: listPlans as unknown as Callable,
  getDashboard: getDashboard as unknown as Callable,
  listActivity: listActivity as unknown as Callable,
  createPlan: createPlan as unknown as Callable,
  getPlan: getPlan as unknown as Callable,
  submitConstraints: submitConstraints as unknown as Callable,
  generateRecommendations: generateRecommendations as unknown as Callable,
  castVote: castVote as unknown as Callable,
  finalizePlan: finalizePlan as unknown as Callable,
  requestParentApproval: requestParentApproval as unknown as Callable,
  getSummaryShareLink: getSummaryShareLink as unknown as Callable,
  getPlanDefaults: getPlanDefaults as unknown as Callable,
  previewFairPointVenues: previewFairPointVenues as unknown as Callable,
  launchAiPlan: launchAiPlan as unknown as Callable,
  getVenueInsight: getVenueInsight as unknown as Callable,
  getFriendPins: getFriendPins as unknown as Callable,
  getSharePeers: getSharePeers as unknown as Callable,
  getSharingState: getSharingState as unknown as Callable,
  shareLocationWith: shareLocationWith as unknown as Callable,
  stopSharingWith: stopSharingWith as unknown as Callable,
  stopWatchingFriend: stopWatchingFriend as unknown as Callable,
  setGhostMode: setGhostMode as unknown as Callable,
  nudgeFriendPin: nudgeFriendPin as unknown as Callable,
  browseSpots: browseSpots as unknown as Callable,
  saveSpot: saveSpot as unknown as Callable,
  unsaveSpot: unsaveSpot as unknown as Callable,
  listSavedSpots: listSavedSpots as unknown as Callable,
});
export const nativeOperationNames = Object.freeze(Object.keys(handlers));
export function nativeOperation(name: string): Callable | undefined {
  return Object.hasOwn(handlers, name) ? handlers[name] : undefined;
}
