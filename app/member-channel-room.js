import { matchMaker } from '@colyseus/core';
import { seatSeconds } from './club-room.js';
import { ReviewRoom } from './review-room.js';

export function memberChannelRoom(roomName) {
  const reservations = new Map();
  const admitted = new Map();

  // Both entry URLs share one seat per member, including while matchmaking is in flight.
  function reserve(identity, expires) {
    if (admitted.has(identity)) throw Error('already_joined');
    if (reservations.has(identity)) return reservations.get(identity);
    const release = () => {
      if (reservations.get(identity) === request) reservations.delete(identity);
    };
    const request = matchMaker.joinOrCreate(roomName, { identity, expires }).then(seat => {
      setTimeout(release, seatSeconds * 1000).unref();
      return seat;
    }).catch(error => {
      release();
      throw error;
    });
    reservations.set(identity, request);
    return request;
  }

  return class MemberChannelRoom extends ReviewRoom {
    static reserve = reserve;
    onCreate() {
      super.onCreate();
      this.setSeatReservationTime(seatSeconds);
    }
    onJoin(client, options) {
      if (admitted.has(options.identity)) throw Error('already_joined');
      super.onJoin(client, options);
      admitted.set(options.identity, client);
      reservations.delete(options.identity);
    }
    onLeave(client) {
      const identity = client.userData?.identity;
      if (admitted.get(identity) === client) admitted.delete(identity);
      if (this.members.has(client.sessionId)) super.onLeave(client);
    }
  };
}
