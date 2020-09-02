FROM nikolaik/python-nodejs

RUN apt-get update && apt-get -y install --no-install-recommends sudo

ARG DEVELOPER_UID=1000
ARG DEVELOPER_GID=1000
ARG DEVELOPER_USER=developer
ARG DEVELOPER_GROUP=${DEVELOPER_USER}
ARG DEVELOPER_HOME=/home/${DEVELOPER_USER}

# Add non-root passwordless user with sudo access
RUN mkdir -p /etc/sudoers.d && \
    addgroup --gid ${DEVELOPER_GID} ${DEVELOPER_GROUP} && \
    adduser --disabled-password --gecos "" --home "${DEVELOPER_HOME}" --uid ${DEVELOPER_UID} --gid ${DEVELOPER_GID} ${DEVELOPER_USER} && \
    usermod -aG sudo ${DEVELOPER_USER} && \
    echo "${DEVELOPER_USER} ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/${DEVELOPER_USER} && \
    chmod 0440 /etc/sudoers.d/${DEVELOPER_USER}

USER ${DEVELOPER_USER}
