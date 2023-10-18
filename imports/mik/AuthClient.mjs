import { fetch } from 'meteor/fetch';
import { Meteor } from 'meteor/meteor';

class KeycloakAuthClient {
  constructor({domain, realm, clientId, authorizationClientId = clientId, username, password}) {
    this.url = `https://${domain}/auth/realms/${realm}/protocol/openid-connect/token`;
    this.clientId = clientId;
    this.authorizationClientId = authorizationClientId;
    this.username = username;
    this.password = password;
    this.realm = realm;
    this.upgraded = false;
  }

  async _fetch(body, headers = {}) {
    const res = await fetch(this.url, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...headers
        },
        method: 'POST',
        body
    });

    console.log('res fetch',headers,res);
    if (!res.ok) {
      throw new Error(res.status)
    }
    return res.json();
  }

  start() {
    if (this.active) return;
    this.active = true;
    return this.refreshTokenByCredentials();
  }

  _scheduleRefreshTokenByCredentials() {
    if (!this.active) return;
    console.log('token lifetime',this.token.expires_in);
    Meteor.clearTimeout(this._refreshByCredentialsTimer);
    // this._refreshByCredentialsTimer = Meteor.setTimeout(() => this.refreshTokenByCredentials(), this.token.refresh_expires_in * 1000 * 0.95);
    this._refreshByCredentialsTimer = Meteor.setTimeout(() => this.refreshTokenByCredentials(), this.token.expires_in * 1000 * 0.95);
  }

  _scheduleRefreshTokenByRefreshToken() {
    if (!this.active) return;
    clearTimeout(this._refreshByTokenTimer);
    this._refreshByTokenTimer = setTimeout(() => this.refreshTokenByRefreshToken(), this.token.expires_in * 1000 * 0.95);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    clearTimeout(this._refreshByCredentialsTimer);
    clearTimeout(this._refreshByTokenTimer);
  }

  fetchTokenByCredentials() {
    const params = new URLSearchParams();
    params.set('client_id', this.clientId);
    params.set('username', this.username);
    params.set('password', this.password);
    params.set('grant_type', 'password');
    return this._fetch(params);
  }

  fetchRefreshToken() {
    const params = new URLSearchParams();
    params.set('client_id', this.clientId);
    params.set('refresh_token', this.token.refresh_token);
    params.set('grant_type', 'refresh_token');
    return this._fetch(params);
  }

  get accessToken() {
    return this.upgraded ? this.token?.access_token : 'DO NOT USE - NOT YET UPGRADED';
  }

  async upgradeTokenWithAuthorization() {
    const params = new URLSearchParams();
    params.set('audience', this.authorizationClientId);
    params.set('grant_type', 'urn:ietf:params:oauth:grant-type:uma-ticket');
    console.log('upgr', this.token, this.access_token);
    this.token = await this._fetch(params, { 'Authorization': `Bearer ${this.token.access_token}`})
    console.log('upgraded', this.token);
    this.upgraded = true;
  }

  async refreshTokenByRefreshToken() {
    this.token = await this.fetchRefreshToken();
    console.log('refreshToken', this.token);
    await this.upgradeTokenWithAuthorization();
    this._scheduleRefreshTokenByRefreshToken();
  }

  async refreshTokenByCredentials() {
    this.upgraded = false;
    this.token = await this.fetchTokenByCredentials();
    console.log('credToken', this.token);
    await this.upgradeTokenWithAuthorization();
    this._scheduleRefreshTokenByCredentials();
  }

  dispose() {
    this.stop();
  }
}

export default KeycloakAuthClient;
