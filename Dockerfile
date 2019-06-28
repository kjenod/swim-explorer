FROM continuumio/miniconda3:latest

LABEL maintainer="SWIM EUROCONTROL <http://www.eurocontrol.int>"

ENV PATH="/opt/conda/envs/app/bin:$PATH"
ENV LD_LIBRARY_PATH=/opt/conda/lib:$LD_LIBRARY_PATH

RUN echo "deb http://archive.ubuntu.com/ubuntu trusty main restricted" >> /etc/apt/sources.list

RUN apt-get update -y; apt-get upgrade -y

RUN apt-get install build-essential tree netcat pkg-config openssl libssl-dev libsasl2-2 libsasl2-dev libsasl2-modules libffi-dev gcc-4.8 python-gevent gunicorn -y --allow-unauthenticated

RUN mkdir -p /app
WORKDIR /app

# for some reason uwsgi cannot compile with later versions of gcc
ENV CC=gcc-4.8

COPY requirements.yml requirements.yml
RUN conda env create --name app -f requirements.yml

ENV CC=gcc

COPY ./swim_explorer/ ./swim_explorer/

COPY . /source/
RUN set -x \
    && pip install /source \
    && rm -rf /source

#RUN echo "source activate swim-explorer" >> ~/.bashrc

CMD ["python", "/app/swim_explorer/app.py"]
