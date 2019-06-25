FROM continuumio/miniconda3:latest

LABEL maintainer="SWIM EUROCONTROL <http://www.eurocontrol.int>"

ENV PATH="/opt/conda/envs/app/bin:$PATH"

RUN apt-get update -y; apt-get upgrade -y

RUN apt-get install build-essential tree netcat pkg-config openssl libssl-dev libsasl2-2 libsasl2-dev libsasl2-modules -y

RUN mkdir -p /app
WORKDIR /app

COPY requirements.yml requirements.yml
RUN conda env create --name app -f requirements.yml

COPY ./swim_explorer/ ./swim_explorer/

COPY . /source/
RUN set -x \
    && pip install /source \
    && rm -rf /source

#RUN echo "source activate swim-explorer" >> ~/.bashrc

CMD ["python", "/app/swim_explorer/app.py"]
